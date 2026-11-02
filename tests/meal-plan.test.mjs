import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  allergenConflicts, buildMessages, llmConfig, mentions, parsePlan, planCost, reviewPlan, weekStart, weeklyBudget,
} from '../supabase/functions/_shared/meal-plan.ts';

const members = [
  { member_id: 'a', name: 'Valentina', allergies: [], activities: ['yoga'] },
  { member_id: 'b', name: 'Lucas', age: 13, allergies: ['peanuts'], conditions: ['hypertension'], activities: ['fútbol'], activity_level: 'high' },
];
const context = {
  household: { id: 'h', name: 'Familia Morales', currency: 'BOB' },
  members,
  food: { monthly_budget: 1600, spent_month: 400, remaining_month: 1200, suggested_weekly: 300 },
  eating_out: { monthly_budget: 400, spent_month: 100, remaining_month: 300, suggested_weekly: 75 },
  rules: {
    forbidden: [
      { code: 'peanuts', keywords: ['mani', 'cacahuate', 'mantequilla de mani', 'peanut'], exclusions: [] },
      { code: 'milk', keywords: ['leche', 'queso'], exclusions: ['leche de coco'] },
    ],
    prompt_rules: [{ kind: 'condition', code: 'hypertension', members: ['Valentina'], rule: 'High blood pressure (DASH): keep sodium low.' }],
    labels: {
      peanuts: { es: 'Maní', en: 'Peanuts', pt: 'Amendoim' },
      milk: { es: 'Leche', en: 'Milk', pt: 'Leite' },
      hypertension: { es: 'Presión alta', en: 'High blood pressure', pt: 'Pressão alta' },
    },
  },
};
const answer = {
  summary: 'Semana económica',
  days: [{ day: 'Lunes', meals: [{ type: 'lunch', name: 'Arroz con pollo', ingredients: ['arroz', 'pollo'], cost: '35,5' }, { name: '' }] }, { day: 'Martes', meals: [] }],
  shopping_list: [{ item: 'Arroz', quantity: '1 kg', cost: 12 }, { item: 'Pollo', quantity: '1 kg', cost: 30.555 }, { item: '', cost: 3 }],
  activities: [{ name: 'Fútbol', for: 'Lucas', cost: -5, why: 'Le gusta' }],
};

test('parsePlan normalizes fenced JSON, drops empty rows and bad numbers', () => {
  const plan = parsePlan('```json\n' + JSON.stringify(answer) + '\n```');
  assert.equal(plan.days.length, 1);
  assert.equal(plan.days[0].meals.length, 1);
  assert.equal(plan.days[0].meals[0].cost, 35.5);
  assert.equal(plan.shopping_list.length, 2);
  assert.equal(plan.activities[0].cost, 0);
  assert.equal(planCost(plan), 42.56);
});

test('parsePlan rejects non-JSON and plans without meals', () => {
  assert.throws(() => parsePlan('lo siento, no puedo'), /llm_invalid_answer/);
  assert.throws(() => parsePlan('{"days":[]}'), /llm_invalid_answer/);
});

test('allergens are detected anywhere and trigger a retry', () => {
  const plan = parsePlan(JSON.stringify({ ...answer, shopping_list: [{ item: 'Mantequilla de maní', quantity: '1', cost: 20 }] }));
  assert.deepEqual(allergenConflicts(plan, context), ['peanuts']);
  const review = reviewPlan(plan, context, 300, 'es');
  assert.match(review.feedback, /Maní/);
});

test('budget review tolerates 5% and flags plans clearly over budget', () => {
  const plan = parsePlan(JSON.stringify(answer));
  assert.equal(reviewPlan(plan, context, 41, 'es').overBudget, false);
  assert.equal(reviewPlan(plan, context, 30, 'es').overBudget, true);
  assert.equal(reviewPlan(plan, context, null, 'es').feedback, '');
});

test('weekly budget prefers the explicit value, then the food suggestion', () => {
  assert.equal(weeklyBudget(context, 250), 250);
  assert.equal(weeklyBudget(context, null), 300);
  assert.equal(weeklyBudget({ ...context, food: { ...context.food, suggested_weekly: null } }, -1), null);
});

test('prompt carries allergens, budget, language and the family request', () => {
  const [system, user] = buildMessages(context, { budget: 300, days: 7, request: 'menos carne', language: 'pt' });
  assert.match(system.content, /Portuguese/);
  assert.match(system.content, /MUST NOT exceed 300 BOB/);
  const payload = JSON.parse(user.content);
  assert.deepEqual(payload.forbidden_allergens, ['Amendoim', 'Leite']);
  assert.equal(payload.family_request, 'menos carne');
  assert.equal(payload.members[1].activity_level, 'high');
});

test('mentions matches whole words, plurals and exclusion phrases', () => {
  assert.equal(mentions('Mantequilla de Maní tostado', ['mani'], []), 'mani');
  assert.equal(mentions('manitas de cerdo', ['mani'], []), null);
  assert.equal(mentions('Huevos revueltos', ['huevo'], []), 'huevo');
  assert.equal(mentions('Leche de coco', ['leche'], ['leche de coco']), null);
  assert.equal(mentions('leche de coco y leche entera', ['leche'], ['leche de coco']), 'leche');
  assert.equal(mentions('Pão de Queijo', ['pao de queijo'], []), 'pao de queijo');
  assert.equal(mentions('leche en polvo', ['polvo'], ['en polvo']), null);
});

test('allergen guard returns codes and skips excluded phrases', () => {
  const peanuts = parsePlan(JSON.stringify({ ...answer, shopping_list: [{ item: 'Mantequilla de maní', quantity: '1', cost: 20 }] }));
  assert.deepEqual(allergenConflicts(peanuts, context), ['peanuts']);
  const coconut = parsePlan(JSON.stringify({ ...answer, shopping_list: [{ item: 'Leche de coco', quantity: '1', cost: 10 }] }));
  assert.deepEqual(allergenConflicts(coconut, context), []);
});

test('prompt uses readable labels and condition rules', () => {
  const [system, user] = buildMessages(context, { budget: 300, days: 7, language: 'en' });
  const payload = JSON.parse(user.content);
  assert.deepEqual(payload.members[1].allergies, ['Peanuts']);
  assert.deepEqual(payload.members[1].conditions, ['High blood pressure']);
  assert.deepEqual(payload.forbidden_allergens, ['Peanuts', 'Milk']);
  assert.match(system.content, /High blood pressure \(Valentina\): High blood pressure \(DASH\)/);
});

test('review feedback names allergen labels', () => {
  const plan = parsePlan(JSON.stringify({ ...answer, shopping_list: [{ item: 'Mantequilla de maní', quantity: '1', cost: 20 }] }));
  assert.match(reviewPlan(plan, context, 300, 'es').feedback, /Maní/);
});

test('context without rules still flags raw allergy text', () => {
  const legacy = {
    ...context,
    rules: undefined,
    members: [
      { member_id: 'a', name: 'Valentina', allergies: [], activities: ['yoga'] },
      { member_id: 'b', name: 'Lucas', age: 13, allergies: ['maní'], activities: ['fútbol'], activity_level: 'high' },
    ],
  };
  const plan = parsePlan(JSON.stringify({ ...answer, shopping_list: [{ item: 'Mantequilla de maní', quantity: '1', cost: 20 }] }));
  assert.deepEqual(allergenConflicts(plan, legacy), ['maní']);
  assert.match(reviewPlan(plan, legacy, 300, 'es').feedback, /maní/);
  const [, user] = buildMessages(legacy, { budget: 300, days: 7, language: 'es' });
  const payload = JSON.parse(user.content);
  assert.deepEqual(payload.forbidden_allergens, ['maní']);
  assert.deepEqual(payload.members[1].allergies, ['maní']);
});

test('LLM provider: Meta Llama first, Groq fallback, placeholder keys ignored', () => {
  assert.equal(llmConfig((k) => ({ LLAMA_API_KEY: 'x', GROQ_API_KEY: 'y' })[k]).provider, 'meta');
  assert.equal(llmConfig((k) => ({ GROQ_API_KEY: 'y' })[k]).provider, 'groq');
  assert.throws(() => llmConfig((k) => ({ GROQ_API_KEY: 'your_groq_api_key_here' })[k]), /llm_not_configured/);
});

test('weekStart returns Monday', () => {
  assert.equal(weekStart(new Date('2026-11-01T12:00:00Z')), '2026-10-26');
  assert.equal(weekStart(new Date('2026-11-02T12:00:00Z')), '2026-11-02');
});
