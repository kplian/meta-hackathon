import type { Database } from '@meta-hackathon/database-types';

export type BudgetSchema = Database['budget'];
export type HouseholdRow = BudgetSchema['Tables']['thousehold']['Row'];
export type UserRow = BudgetSchema['Tables']['tuser']['Row'];
export type ChannelRow = BudgetSchema['Tables']['tchannel']['Row'];
export type AccountTypeRow = BudgetSchema['Tables']['taccount_type']['Row'];
export type AuxiliarTypeRow = BudgetSchema['Tables']['tauxiliar_type']['Row'];
export type BusinessTypeRow = BudgetSchema['Tables']['tbusiness_type']['Row'];
export type AccountRow = BudgetSchema['Tables']['taccount']['Row'];
export type BudgetTypeRow = BudgetSchema['Tables']['tbudget_type']['Row'];
export type FinancialPyramidRow = BudgetSchema['Tables']['tfinancial_pyramid']['Row'];
export type FinancialPyramidLevelRow = BudgetSchema['Tables']['tfinancial_pyramid_level']['Row'];
export type TemplateTransactionRow = BudgetSchema['Tables']['ttemplate_transaction']['Row'];
export type TemplateTransactionDetRow = BudgetSchema['Tables']['ttemplate_transaction_det']['Row'];
export type HouseholdMemberRow = BudgetSchema['Tables']['thousehold_member']['Row'];
export type AuxiliarRow = BudgetSchema['Tables']['tauxiliar']['Row'];
export type BudgetRow = BudgetSchema['Tables']['tbudget']['Row'];










