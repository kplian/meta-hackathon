import type { AssetRegistration } from '../onboarding/AssetsStep';
export type Asset = { id: string; name: string; alias: string | null; symbol: string | null; unit_code: string; current_quantity: number; current_unit_price_usd: number; value_usd: number; valuation_as_of: string; quote_missing: boolean; has_untracked_movements: boolean; valuation_basis: string };
export type Account = { id: string; code: string; name: string; currency: string; balance: number };
export type Movement = { id: string; created_at: string; source_name: string; destination_name: string; source_unit: string; destination_unit: string; source_quantity: number; destination_quantity: number; settlement_usd: number | null; realized_result_usd: number };
export type Overview = { currency: string; available: number; can_manage: boolean; accounts: Account[]; wealth: { total: number; assets: Asset[] }; history: Movement[] };
export type Endpoint = { key: string; kind: 'operating' | 'position' | 'new'; id?: string; label: string; unit: string; balance?: number; price?: number; draft?: AssetRegistration };
