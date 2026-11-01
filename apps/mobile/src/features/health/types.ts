export type HealthMember = {
  member_id: string;
  name: string;
  member_type: string;
  role: string;
  birth_year: number | null;
  age: number | null;
  allergies: string[];
  diet: string[];
  likes: string[];
  dislikes: string[];
  activity_level: 'low' | 'moderate' | 'high' | null;
  activities: string[];
  health_goal: string | null;
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

export const DIET_OPTIONS = ['vegetarian', 'vegan', 'gluten_free', 'lactose_free', 'low_sugar', 'low_salt'] as const;
export const GOAL_OPTIONS = ['maintain', 'eat_healthier', 'lose_weight', 'gain_muscle', 'more_energy'] as const;
export const LEVEL_OPTIONS = ['low', 'moderate', 'high'] as const;
