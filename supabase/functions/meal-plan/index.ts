// Weekly meal plan + activity ideas generated with a Llama model.
// POST { action: "generate", householdId, weekStart?, budget?, days?, request?, language? }
// Authorization: the user's JWT (app) or the service role key (n8n). The
// caller's token is forwarded to PostgREST, so household access is enforced
// by the RPCs themselves.
import {
  buildMessages,
  llmConfig,
  MealPlanError,
  parsePlan,
  reviewPlan,
  weekStart,
  weeklyBudget,
  type HealthContext,
  type Language,
  type Plan,
} from '../_shared/meal-plan.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const limits = new Map<string, { count: number; reset: number }>();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function rpc(name: string, args: Record<string, unknown>, authorization: string) {
  const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(10000),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = String(body?.message ?? '');
    if (message.includes('access denied')) throw new MealPlanError('forbidden', 403);
    if (message.startsWith('allergen_conflict')) throw new MealPlanError('allergen_conflict', 422, message);
    throw new MealPlanError('database_error', 502, message);
  }
  return body;
}

async function askModel(messages: unknown[]): Promise<{ plan: Plan; model: string }> {
  const config = llmConfig((name) => Deno.env.get(name));
  const response = await fetch(config.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0.4,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new MealPlanError('llm_unavailable', 502, await response.text().catch(() => ''));
  const body = await response.json();
  const content = body?.choices?.[0]?.message?.content ?? body?.completion_message?.content?.text ?? '';
  return { plan: parsePlan(String(content)), model: `${config.provider}:${config.model}` };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);

    const caller = authorization.slice(-24);
    if (limits.size > 10000) limits.clear();
    const limit = limits.get(caller);
    if (limit && limit.reset > Date.now() && limit.count >= 10) return json({ error: 'rate_limited' }, 429);
    limits.set(caller, limit && limit.reset > Date.now() ? { ...limit, count: limit.count + 1 } : { count: 1, reset: Date.now() + 60000 });

    const text = await request.text();
    if (text.length > 4000) return json({ error: 'invalid_request' }, 400);
    let input: any;
    try { input = JSON.parse(text); } catch { return json({ error: 'invalid_request' }, 400); }
    if (input?.action !== 'generate' || typeof input.householdId !== 'string' || !UUID.test(input.householdId)) {
      return json({ error: 'invalid_request' }, 400);
    }
    const language: Language = ['es', 'en', 'pt'].includes(input.language) ? input.language : 'es';
    const days = Number.isInteger(input.days) ? Math.min(7, Math.max(1, input.days)) : 7;
    const userRequest = typeof input.request === 'string' ? input.request.trim().slice(0, 500) : '';
    const week = typeof input.weekStart === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.weekStart) ? input.weekStart : weekStart();

    const context = (await rpc('f_get_family_health_context', { p_household_id: input.householdId }, authorization)) as HealthContext;
    const budget = weeklyBudget(context, typeof input.budget === 'number' ? input.budget : null);

    const messages = buildMessages(context, { budget, days, request: userRequest, language });
    let { plan, model } = await askModel(messages);
    let review = reviewPlan(plan, context.members, budget);
    if (review.feedback) {
      // One correction round with the model's own answer as context.
      const retry = await askModel([...messages, { role: 'assistant', content: JSON.stringify(plan) }, { role: 'user', content: review.feedback }]);
      plan = retry.plan;
      review = reviewPlan(plan, context.members, budget);
    }
    if (review.allergens.length) return json({ error: 'allergen_conflict', allergens: review.allergens }, 422);

    const saved = await rpc('f_save_meal_plan', {
      p_household_id: input.householdId,
      p_week_start: week,
      p_plan: plan,
      p_budget: budget,
      p_user_request: userRequest || null,
      p_source: 'ai',
      p_model: model,
    }, authorization);
    return json({ plan: saved, over_budget: review.overBudget });
  } catch (error) {
    if (error instanceof MealPlanError) return json({ error: error.code }, error.status);
    return json({ error: 'meal_plan_unavailable' }, 502);
  }
});
