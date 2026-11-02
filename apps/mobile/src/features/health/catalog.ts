import { supabase } from '../../lib/supabase';
import type { HealthOption, HealthOptionKind } from './types';

export async function loadHealthCatalog(): Promise<HealthOption[]> {
  const result = await supabase.schema('budget').from('thealth_option')
    .select('kind,code,icon,sort_order,hard,implies_allergen,labels,prompt_rule').order('kind').order('sort_order');
  if (result.error) throw result.error;
  return (result.data ?? []) as unknown as HealthOption[];
}

export const byKind = (catalog: HealthOption[], kind: HealthOptionKind) => catalog.filter((o) => o.kind === kind);

export const optionLabel = (option: HealthOption, lang: string) => option.labels[lang] ?? option.labels.es ?? option.code;

/** Label for a stored value: catalog label when it is a code, the raw text otherwise ("Otro"). */
export function valueLabel(catalog: HealthOption[], kind: HealthOptionKind, value: string, lang: string) {
  const option = catalog.find((o) => o.kind === kind && o.code === value);
  return option ? { label: optionLabel(option, lang), icon: option.icon, custom: false } : { label: value, icon: 'create-outline', custom: true };
}
