import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSavings } from '../apps/mobile/src/features/savings/summary.ts';
const valid = { generated: 2000, target: 2000, gap: 0, achieved: true, investment_contributions: 2000, vault_contributions: 0, investment_returns: 0, vault_returns: 0, previous_month: '2026-10', previous_generated: 2000 };
test('old or incomplete backend responses cannot be rendered as savings', () => {
 for (const value of [undefined, null, {}, { generated: 2000 }, { ...valid, target: undefined }, { ...valid, gap: NaN }, { ...valid, previous_month: '2026-13' }]) assert.equal(isSavings(value), false);
});
test('current responses support surplus and deficit without inventing balances', () => {
 assert.equal(isSavings(valid), true);
 assert.equal(isSavings({ ...valid, generated: -500, achieved: false, gap: 2500 }), true);
});
