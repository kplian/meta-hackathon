import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const patch = JSON.parse(readFileSync(new URL('../n8n/patches/transaction-json-body.json', import.meta.url), 'utf8'));
const defaults = { type: 'expense', concept: 'Supermercado', category_key: 'supermarket_groceries', amount: 25.5, items: [] };
function payload(overrides = {}) {
  const ai = { ...defaults, ...overrides };
  const value = vm.runInNewContext(patch.parameters.jsonBody.slice(3, -2), {
    $fromAI: key => {
      assert.ok(!/date|fecha/i.test(key), 'Date must never be requested from the model');
      return ai[key];
    },
    $: name => {
      assert.equal(name, 'Webhook');
      return { first: () => ({ json: { body: { entry: [{ changes: [{ value: { messages: [{ from: '15550000001' }] } }] }] } } }) };
    },
  }, { timeout: 100 });
  return JSON.parse(JSON.stringify(value));
}

test('historical doubled household quotes create invalid JSON', () => {
  const name = 'Familia A';
  assert.throws(() => JSON.parse('{"p_household_name": "' + '"' + name + '"' + '"}'), SyntaxError);
  assert.equal(payload({ household_name: name }).p_household_name, name);
});

test('quotes, backslashes, newlines, accents and emoji survive JSON serialization', () => {
  const text = 'Compra "especial"\\hogar\nCafé ☕';
  const result = payload({ concept: text, household_name: text, auxliar: text });
  assert.equal(result.p_concept, text);
  assert.equal(result.p_household_name, text);
  assert.equal(result.p_auxiliar_code, text);
});

test('optional absent values and textual null become JSON null', () => {
  for (const value of [undefined, null, '', '  ', 'null', ' NULL ', 'undefined']) {
    const result = payload({ household_name: value, trasnsaction_date: value, auxliar: value });
    assert.equal(result.p_household_name, null);
    assert.equal(result.p_transaction_date, null);
    assert.equal(result.p_auxiliar_code, null);
  }
});

test('item arrays and JSON-encoded arrays preserve all invoice detail', () => {
  const items = [{ concept: 'Leche "entera"', category: 'supermarket_groceries', amount: 25.5, quantity: 1, unit_price: 25.5 }];
  assert.deepEqual(payload({ items }).p_items, items);
  assert.deepEqual(payload({ items: JSON.stringify(items) }).p_items, items);
});

test('malformed invoice JSON is rejected rather than discarded', () => {
  for (const items of ['[{"concept":"Leche"', 'not JSON', '{"amount":25}', 'null', '{}']) {
    assert.throws(() => payload({ items }), /INVALID_ITEMS_JSON/);
  }
});

test('non-object invoice entries and non-array details are rejected', () => {
  for (const items of [{ amount: 25 }, [null], ['item'], [[{ amount: 25 }]], [12]]) {
    assert.throws(() => payload({ items }), /INVALID_ITEMS_JSON/);
  }
});

test('a simple transaction has an empty array, not an encoded string', () => {
  for (const items of [undefined, null, '', '[]', []]) assert.deepEqual(payload({ items }).p_items, []);
});

test('amount is finite and numeric, with no partial parse or silent truncation', () => {
  assert.equal(payload({ amount: '25.50' }).p_amount, 25.5);
  for (const amount of [undefined, null, '', ' ', '25,50', '25 BOB', 'abc', 0, -1, Infinity, NaN]) {
    assert.throws(() => payload({ amount }), /INVALID_AMOUNT/);
  }
});

test('income and sender remain intact while model-supplied dates are ignored', () => {
  const result = payload({ type: 'income', trasnsaction_date: '2026-11-02', p_channel_code: 'spoofed' });
  assert.equal(result.p_type, 'income');
  assert.equal(result.p_transaction_date, null);
  assert.equal(result.p_channel_type, 'whatsapp');
  assert.equal(result.p_channel_code, '15550000001');
});

test('missing, past and future model dates all defer to database server time', () => {
  for (const date of [undefined, null, '2000-01-01', '2099-12-31', 'invalid date']) {
    assert.equal(payload({ trasnsaction_date: date, transaction_date: date }).p_transaction_date, null);
  }
});
