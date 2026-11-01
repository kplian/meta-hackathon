// Integer hundredths avoid floating-point errors such as 33.33 + 33.33 + 33.34.
export function percentageUnits(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(normalized)) return null;
  const units = Math.round(Number(normalized) * 100);
  return units <= 10000 ? units : null;
}
export function percentageSummary(values: string[]) {
  const units = values.map(percentageUnits);
  const total = units.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  return { units, total, valid: values.length > 0 && units.every(value => value !== null) && total === 10000 };
}
export function monthlyIncome(sources: { estimated_amount: number; currency: string; frequency: string }[], currency: string) {
  // The app labels biweekly as Quincenal: two installments per month.
  const factors: Record<string, number> = { monthly: 1, weekly: 52 / 12, biweekly: 2, yearly: 1 / 12 };
  let total = 0; let excluded = 0;
  for (const source of sources) {
    const amount = Number(source.estimated_amount);
    if (source.currency.trim() !== currency || !factors[source.frequency] || !Number.isFinite(amount) || amount < 0) { excluded++; continue; }
    total += amount * factors[source.frequency];
  }
  return { total: Math.round(total * 100) / 100, excluded };
}
export function allocateIncome(total: number, units: number[]): number[] {
  const cents = Math.round(total * 100);
  if (!Number.isSafeInteger(cents) || cents < 0 || units.some(n => !Number.isInteger(n) || n < 0) || units.reduce((a, b) => a + b, 0) !== 10000) return [];
  const exact = units.map(value => cents * (value / 10000));
  const amounts = exact.map(Math.floor);
  const remainder = cents - amounts.reduce((a, b) => a + b, 0);
  const order = exact.map((value, i) => ({ i, fraction: value - amounts[i] })).sort((a, b) => b.fraction - a.fraction || a.i - b.i);
  for (let i = 0; i < remainder; i++) amounts[order[i % order.length].i]++;
  return amounts.map(value => value / 100);
}
