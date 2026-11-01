export type HealthOptionKind = 'allergen' | 'diet' | 'condition' | 'activity' | 'goal' | 'activity_level';

export type HealthOption = {
  kind: HealthOptionKind;
  code: string;
  icon: string;
  sort_order: number;
  hard: boolean;
  implies_allergen: string | null;
  labels: Record<string, string>;
  prompt_rule: string | null;
};

export type HealthRules = {
  forbidden: { code: string; keywords: string[]; exclusions: string[] }[];
  prompt_rules: { kind: string; code: string; members: string[]; rule: string }[];
  labels: Record<string, Record<string, string>>;
};

export type HealthMember = {
  member_id: string;
  name: string;
  member_type: string;
  role: string;
  birth_year: number | null;
  age: number | null;
  allergies: string[];
  conditions: string[];
  diet: string[];
  likes: string[];
  dislikes: string[];
  activity_level: 'low' | 'moderate' | 'high' | null;
  activities: string[];
  health_goal: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  notes: string | null;
  has_profile: boolean;
};

export type CategoryStatus = {
  monthly_budget: number | null;
  spent_month: number;
  remaining_month: number | null;
  suggested_weekly: number | null;
};

export type HealthContext = {
  household: { id: string; name: string; currency: string };
  members: HealthMember[];
  food: CategoryStatus;
  eating_out: CategoryStatus;
  health: CategoryStatus;
  rules: HealthRules;
};

export type MealPlan = {
  id: string;
  week_start: string;
  currency: string;
  budget_amount: number | null;
  estimated_cost: number;
  within_budget: boolean;
  summary: string | null;
  days: { day: string; meals: { type: string; name: string; ingredients: string[]; cost: number; for?: string }[] }[];
  shopping_list: { item: string; quantity: string; cost: number }[];
  activities: { name: string; for: string; cost: number; why: string }[];
};
