import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSystemPrompt,
  parseJournalAiResponse,
  JournalAiError,
} from '../supabase/functions/_shared/journal-ai.ts';

const categories = [
  { key: 'supermarket_groceries', name: 'Supermercado y Alimentos' },
  { key: 'fuel_transport', name: 'Transporte y Combustible' },
  { key: 'pharmacy_health', name: 'Salud y Farmacia' },
  { key: 'dining_out', name: 'Restaurantes y Salidas' },
];

test('buildSystemPrompt includes currency and listed categories', () => {
  const prompt = buildSystemPrompt('BOB', categories);
  assert.match(prompt, /Household currency: BOB/);
  assert.match(prompt, /- supermarket_groceries \(Supermercado y Alimentos\)/);
  assert.match(prompt, /- fuel_transport \(Transporte y Combustible\)/);
  assert.match(prompt, /"concept": "Merchant or main concept"/);
});

test('parseJournalAiResponse parses raw JSON correctly', () => {
  const raw = JSON.stringify({
    concept: 'Supermercado Líder',
    amount: '145.50',
    category: 'supermarket_groceries',
    type: 'expense',
    items: [
      { concept: 'Leche y pan', amount: '45.50', category: 'supermarket_groceries' },
      { concept: 'Carnes', amount: '100.00', category: 'supermarket_groceries' },
    ],
    confidence: 0.98,
  });

  const result = parseJournalAiResponse(raw, categories);
  assert.equal(result.concept, 'Supermercado Líder');
  assert.equal(result.amount, '145.50');
  assert.equal(result.category, 'supermarket_groceries');
  assert.equal(result.type, 'expense');
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].concept, 'Leche y pan');
  assert.equal(result.items[0].amount, '45.50');
  assert.equal(result.confidence, 0.98);
});

test('parseJournalAiResponse strips markdown fences and fuzzy matches category', () => {
  const fenced = `\`\`\`json
{
  "concept": "Farmacia San Rafael",
  "amount": 68,
  "category": "Salud y Farmacia",
  "type": "expense"
}
\`\`\``;

  const result = parseJournalAiResponse(fenced, categories);
  assert.equal(result.concept, 'Farmacia San Rafael');
  assert.equal(result.amount, '68.00');
  assert.equal(result.category, 'pharmacy_health'); // Matched name to key!
  assert.equal(result.type, 'expense');
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].concept, 'Farmacia San Rafael');
  assert.equal(result.items[0].amount, '68.00');
});

test('parseJournalAiResponse handles income correctly', () => {
  const raw = JSON.stringify({
    concept: 'Pago de sueldo mensual',
    amount: '10000.00',
    category: 'general',
    type: 'income',
  });

  const result = parseJournalAiResponse(raw, categories);
  assert.equal(result.concept, 'Pago de sueldo mensual');
  assert.equal(result.amount, '10000.00');
  assert.equal(result.type, 'income');
});

test('parseJournalAiResponse throws on non-JSON content', () => {
  assert.throws(
    () => parseJournalAiResponse('No pude procesar la solicitud', categories),
    (err) => err instanceof JournalAiError && err.code === 'invalid_json_format'
  );
});

