export type Savings = {
  generated: number; target: number; gap: number; achieved: boolean;
  investment_contributions: number; vault_contributions: number;
  investment_returns: number; vault_returns: number;
  previous_month: string; previous_generated: number;
};
export function isSavings(value: unknown): value is Savings {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  return ['generated', 'target', 'gap', 'investment_contributions', 'vault_contributions', 'investment_returns', 'vault_returns', 'previous_generated']
    .every(key => typeof data[key] === 'number' && Number.isFinite(data[key]))
    && typeof data.achieved === 'boolean' && typeof data.previous_month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(data.previous_month);
}
