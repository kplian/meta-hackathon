// Pure helpers for the meal-plan Edge Function (no Deno globals, testable with node --test).

export type Member = {
  member_id: string;
  name: string;
  member_type?: string;
  age?: number | null;
  allergies?: string[];
  diet?: string[];
  likes?: string[];
  dislikes?: string[];
  activity_level?: string | null;
  activities?: string[];
  health_goal?: string | null;
  notes?: string | null;
};

type CategoryStatus = {
  monthly_budget: number | null;
  spent_month: number;
  remaining_month: number | null;
  suggested_weekly: number | null;
};

export type HealthContext = {
  household: { id: string; name: string; currency: string };
  members: Member[];
  food: CategoryStatus;
  eating_out: CategoryStatus;
  health?: CategoryStatus;
};

export type Meal = { type: string; name: string; ingredients: string[]; cost: number; for?: string };
export type Day = { day: string; meals: Meal[] };
export type ShoppingItem = { item: string; quantity: string; cost: number };
export type Activity = { name: string; for: string; cost: number; why: string };
export type Plan = { summary: string; days: Day[]; shopping_list: ShoppingItem[]; activities: Activity[] };

export type Language = 'es' | 'en' | 'pt';

export class MealPlanError extends Error {
  code: string;
  status: number;
  constructor(code: string, status = 400, message?: string) {
    super(message ?? code);
    this.code = code;
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// LLM provider: Meta Llama API by default, Groq (Llama models) as fallback.
// Both speak the OpenAI chat-completions format.
// ---------------------------------------------------------------------------
export type LlmConfig = { url: string; key: string; model: string; provider: string };

export function llmConfig(env: (name: string) => string | undefined): LlmConfig {
  const custom = env('LLM_API_KEY');
  if (custom) {
    return {
      url: env('LLM_API_URL') ?? 'https://api.llama.com/compat/v1/chat/completions',
      key: custom,
      model: env('LLM_MODEL') ?? 'Llama-4-Maverick-17B-128E-Instruct-FP8',
      provider: 'custom',
    };
  }
  const llama = env('LLAMA_API_KEY');
  if (llama) {
    return {
      url: 'https://api.llama.com/compat/v1/chat/completions',
      key: llama,
      model: env('LLM_MODEL') ?? 'Llama-4-Maverick-17B-128E-Instruct-FP8',
      provider: 'meta',
    };
  }
  const groq = env('GROQ_API_KEY');
  if (groq && !groq.startsWith('your_')) {
    return {
      url: 'https://api.groq.com/openai/v1/chat/completions',
      key: groq,
      model: env('LLM_MODEL') ?? 'meta-llama/llama-4-scout-17b-16e-instruct',
      provider: 'groq',
    };
  }
  throw new MealPlanError('llm_not_configured', 503);
}

// ---------------------------------------------------------------------------
// Budget for the week: explicit value, else what the food budget suggests.
// ---------------------------------------------------------------------------
export function weeklyBudget(context: HealthContext, explicit?: number | null): number | null {
  if (typeof explicit === 'number' && Number.isFinite(explicit) && explicit > 0) return round2(explicit);
  const suggested = context.food?.suggested_weekly;
  return typeof suggested === 'number' && suggested > 0 ? round2(suggested) : null;
}

const LANGUAGE_NAME: Record<Language, string> = { es: 'Spanish', en: 'English', pt: 'Portuguese' };

export function buildMessages(
  context: HealthContext,
  options: { budget: number | null; days: number; request?: string; language: Language; feedback?: string },
) {
  const members = context.members.map((m) => ({
    name: m.name,
    role: m.member_type,
    age: m.age ?? undefined,
    allergies: m.allergies?.length ? m.allergies : undefined,
    diet: m.diet?.length ? m.diet : undefined,
    likes: m.likes?.length ? m.likes : undefined,
    dislikes: m.dislikes?.length ? m.dislikes : undefined,
    activity_level: m.activity_level ?? undefined,
    activities: m.activities?.length ? m.activities : undefined,
    health_goal: m.health_goal ?? undefined,
    notes: m.notes ?? undefined,
  }));
  const allergies = [...new Set(context.members.flatMap((m) => m.allergies ?? []))];
  const leisure = context.eating_out?.remaining_month;
  const system = [
    'You are a family nutrition and wellbeing assistant inside a household budget app.',
    `Answer ONLY with one JSON object, all text in ${LANGUAGE_NAME[options.language]}.`,
    'Schema: {"summary": string (2 sentences max), "days": [{"day": string, "meals": [{"type": "breakfast"|"lunch"|"dinner"|"snack", "name": string, "ingredients": [string], "cost": number, "for": string (optional, a member name when the meal is only for that member)}]}], "shopping_list": [{"item": string, "quantity": string, "cost": number}], "activities": [{"name": string, "for": string, "cost": number, "why": string}]}.',
    'Rules:',
    '- Allergies are absolute: never use, mention or name an allergen anywhere, not even as "without X".',
    '- Respect each diet and avoid dislikes; prefer likes. Adapt portions to ages.',
    '- Simple, cheap home cooking with local, seasonal ingredients; reuse ingredients across days to avoid waste.',
    `- Costs are realistic estimates in ${context.household.currency}. The shopping list covers every ingredient bought this week; the sum of shopping_list costs is the weekly food cost.`,
    options.budget
      ? `- The sum of shopping_list costs MUST NOT exceed ${options.budget} ${context.household.currency}.`
      : '- No food budget is set: keep it economical.',
    '- activities: 2 or 3 physical or family activities matching members activity level, sports and goals.' +
      (typeof leisure === 'number' ? ` Total cost must fit ${Math.max(0, leisure)} ${context.household.currency}; prefer free ones.` : ' Prefer free or very cheap ones.'),
    '- No medical diagnosis. Keep names short.',
  ].join('\n');
  const user = JSON.stringify({
    task: `Weekly meal plan for ${options.days} day(s) plus activity ideas.`,
    household: context.household.name,
    currency: context.household.currency,
    weekly_food_budget: options.budget,
    forbidden_allergens: allergies,
    members,
    family_request: options.request || undefined,
  });
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
  if (options.feedback) messages.push({ role: 'user', content: options.feedback });
  return messages;
}

// ---------------------------------------------------------------------------
// Parse and normalize the model answer.
// ---------------------------------------------------------------------------
export function parsePlan(raw: string, maxDays = 7): Plan {
  let text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new MealPlanError('llm_invalid_answer', 502);
  text = text.slice(start, end + 1);
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new MealPlanError('llm_invalid_answer', 502);
  }
  const str = (v: unknown, max = 120) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const num = (v: unknown) => {
    const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(',', '.')) : NaN;
    return Number.isFinite(n) && n >= 0 ? round2(n) : 0;
  };
  const days: Day[] = (Array.isArray(data?.days) ? data.days : [])
    .slice(0, maxDays)
    .map((d: any) => ({
      day: str(d?.day, 30),
      meals: (Array.isArray(d?.meals) ? d.meals : [])
        .map((m: any) => {
          const meal: Meal = {
            type: str(m?.type, 20) || 'meal',
            name: str(m?.name),
            ingredients: (Array.isArray(m?.ingredients) ? m.ingredients : []).map((i: unknown) => str(i, 60)).filter(Boolean).slice(0, 15),
            cost: num(m?.cost),
          };
          const target = str(m?.for, 60);
          if (target) meal.for = target;
          return meal;
        })
        .filter((m: Meal) => m.name),
    }))
    .filter((d: Day) => d.meals.length);
  if (!days.length) throw new MealPlanError('llm_invalid_answer', 502);
  const shopping_list: ShoppingItem[] = (Array.isArray(data?.shopping_list) ? data.shopping_list : [])
    .map((s: any) => ({ item: str(s?.item, 80), quantity: str(s?.quantity, 40), cost: num(s?.cost) }))
    .filter((s: ShoppingItem) => s.item)
    .slice(0, 60);
  const activities: Activity[] = (Array.isArray(data?.activities) ? data.activities : [])
    .map((a: any) => ({ name: str(a?.name), for: str(a?.for, 80), cost: num(a?.cost), why: str(a?.why, 200) }))
    .filter((a: Activity) => a.name)
    .slice(0, 5);
  return { summary: str(data?.summary, 400), days, shopping_list, activities };
}

export function planCost(plan: Plan): number {
  return round2(plan.shopping_list.reduce((sum, s) => sum + s.cost, 0));
}

// Allergens mentioned anywhere in meals or shopping items (same rule as f_save_meal_plan).
export function allergenConflicts(plan: Plan, members: Member[]): string[] {
  const text = JSON.stringify({ days: plan.days, shopping_list: plan.shopping_list }).toLowerCase();
  const allergens = [...new Set(members.flatMap((m) => m.allergies ?? []).map((a) => a.toLowerCase().trim()))];
  return allergens.filter((a) => a.length >= 3 && text.includes(a));
}

// Issues worth one retry: allergens (blocking) or a plan clearly over budget.
export function reviewPlan(plan: Plan, members: Member[], budget: number | null) {
  const allergens = allergenConflicts(plan, members);
  const cost = planCost(plan);
  const overBudget = budget !== null && cost > budget * 1.05;
  const problems: string[] = [];
  if (allergens.length) problems.push(`Remove every trace of these allergens, do not even name them: ${allergens.join(', ')}.`);
  if (overBudget) problems.push(`The shopping list costs ${cost}, above the budget of ${budget}. Make it cheaper.`);
  return { allergens, cost, overBudget, feedback: problems.length ? `Fix the previous answer. ${problems.join(' ')} Answer with the full corrected JSON.` : '' };
}

export function weekStart(date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const offset = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}
