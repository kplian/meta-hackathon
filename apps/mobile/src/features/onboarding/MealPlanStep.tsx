import '../health/i18n';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import MealPlanView from '../health/MealPlanView';
import type { MealPlan } from '../health/types';

type Phase = 'budget' | 'generating' | 'error' | 'plan';

type Suggestion = {
  monthly_income?: unknown;
  needs_percentage?: unknown;
  needs_amount?: unknown;
  suggested_monthly?: unknown;
  current_limit?: unknown;
};

interface Props {
  householdId: string;
  currency: string;
  finishing: boolean;
  onFinish: () => Promise<void>;
  onBack: () => void;
}

function numberFrom(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function parseAmount(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function toWeekly(monthly: number): number {
  return Math.round(monthly * 12 / 52 * 100) / 100;
}

export default function MealPlanStep({ householdId, currency, finishing, onFinish, onBack }: Props) {
  const { t, i18n } = useTranslation('onboarding');
  const [phase, setPhase] = useState<Phase>('budget');
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [amount, setAmount] = useState('');
  const [income, setIncome] = useState(0);
  const [needsAmount, setNeedsAmount] = useState(0);
  const [needsPct, setNeedsPct] = useState(0);
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [errorCode, setErrorCode] = useState('default');
  const [pendingWeekly, setPendingWeekly] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const suggestionRequest = useRef(0);

  const money = (value: number) => new Intl.NumberFormat(i18n.language, { style: 'currency', currency }).format(value);
  const parsed = parseAmount(amount);
  const amountValid = parsed !== null && parsed > 0;
  const weekly = parsed === null ? 0 : toWeekly(parsed);
  const locked = finishing || submitting || phase === 'generating';

  async function load() {
    const request = ++suggestionRequest.current;
    setLoading(true);
    try {
      const result = await supabase.rpc('f_food_budget_suggestion', { p_household_id: householdId });
      if (request !== suggestionRequest.current) return;
      const data = result.data;
      if (result.error || !data || typeof data !== 'object' || Array.isArray(data)) {
        setLoadFailed(true);
        return;
      }
      const suggestion = data as Suggestion;
      const current = numberFrom(suggestion.current_limit);
      const suggested = numberFrom(suggestion.suggested_monthly);
      const seed = current > 0 ? current : suggested;
      setAmount(seed > 0 ? String(seed) : '');
      setIncome(numberFrom(suggestion.monthly_income));
      setNeedsAmount(numberFrom(suggestion.needs_amount));
      setNeedsPct(suggestion.needs_percentage == null ? 0 : numberFrom(suggestion.needs_percentage));
      setLoadFailed(false);
    } catch {
      if (request !== suggestionRequest.current) return;
      setLoadFailed(true);
    } finally {
      if (request === suggestionRequest.current) setLoading(false);
    }
  }

  useEffect(() => {
    setAmount('');
    setIncome(0);
    void load();
    return () => { suggestionRequest.current += 1; };
  }, [householdId]);

  async function leave() {
    if (finishing || submitting || phase === 'generating' || inFlight.current) return;
    setSubmitting(true);
    try { await onFinish(); }
    finally { setSubmitting(false); }
  }

  async function requestPlan(weeklyBudget: number) {
    setPhase('generating');
    setSaveError(null);
    try {
      const response = await supabase.functions.invoke('meal-plan', {
        body: {
          action: 'generate',
          householdId,
          budget: weeklyBudget,
          language: (i18n.language || 'es').slice(0, 2),
        },
      });
      if (response.error) {
        let code = 'default';
        try { code = (await response.error.context.json()).error ?? 'default'; } catch { /* No response body. */ }
        setErrorCode(code);
        setPhase('error');
        return;
      }
      const next = (response.data as { plan: MealPlan }).plan;
      if (!next) {
        setErrorCode('default');
        setPhase('error');
        return;
      }
      setPlan(next);
      setPhase('plan');
    } catch {
      setErrorCode('default');
      setPhase('error');
    }
  }

  async function saveAndGenerate() {
    if (!amountValid || parsed === null || locked || loading || inFlight.current) return;
    const weeklyBudget = toWeekly(parsed);
    inFlight.current = true;
    setSaveError(null);
    setPhase('generating');
    try {
      const saved = await supabase.rpc('f_set_food_budget', {
        p_household_id: householdId,
        p_monthly_limit: parsed,
      });
      if (saved.error) {
        setSaveError(t('saveError'));
        setPhase('budget');
        return;
      }
      setPendingWeekly(weeklyBudget);
      await requestPlan(weeklyBudget);
    } catch {
      setSaveError(t('saveError'));
      setPhase('budget');
    } finally {
      inFlight.current = false;
    }
  }

  function retry() {
    if (pendingWeekly === null || inFlight.current || finishing || submitting) return;
    inFlight.current = true;
    void requestPlan(pendingWeekly).finally(() => { inFlight.current = false; });
  }

  const suggestionPending = loading && !loadFailed;
  const generateDisabled = !amountValid || locked || suggestionPending;
  const showInvalid = !suggestionPending && amount.trim() !== '' && !amountValid;
  const leaveDisabled = finishing || submitting;

  return (
    <View className="mt-6 gap-4" testID="onboarding-meal-plan">
      {phase === 'plan' && plan ? (
        <>
          <MealPlanView plan={plan} currency={currency} />
          <Text className="text-sm leading-5 text-sage">{t('mealPlan.saved')}</Text>
          <Pressable
            onPress={() => void leave()}
            disabled={leaveDisabled}
            accessibilityRole="button"
            accessibilityState={{ disabled: leaveDisabled }}
            className={`mt-4 items-center rounded-2xl bg-pine py-4 ${leaveDisabled ? 'opacity-50' : ''}`}
          >
            {leaveDisabled ? <ActivityIndicator color="white" /> : <Text className="text-base font-bold text-white">{t('mealPlan.start')}</Text>}
          </Pressable>
        </>
      ) : (
        <>
          <View className="rounded-2xl bg-white p-5">
            <Text className="text-lg font-bold text-pine">{t('mealPlan.budgetTitle')}</Text>
            {loading && !loadFailed ? <ActivityIndicator className="mt-4" color="#0B3D2E" /> : (
              <>
                {loadFailed ? (
                  <Text accessibilityRole="alert" className="mt-2 text-sm leading-5 text-red-700">{t('mealPlan.loadError')}</Text>
                ) : (
                  <Text className="mt-2 text-sm leading-5 text-sage">
                    {income > 0
                      ? t('mealPlan.budgetHelp', { needs: money(needsAmount), pct: needsPct, share: 40 })
                      : t('mealPlan.noIncome')}
                  </Text>
                )}
                {loadFailed ? <Pressable onPress={() => void load()} accessibilityRole="button" className="p-3"><Text className="text-pine">{t('income.retry')}</Text></Pressable> : null}
                <Text className="mt-4 font-semibold text-pine">{t('mealPlan.monthly')}</Text>
                <TextInput
                  value={amount}
                  onChangeText={(value) => { setAmount(value); setSaveError(null); }}
                  keyboardType="decimal-pad"
                  editable={phase === 'budget' && !finishing && !submitting}
                  accessibilityLabel={t('mealPlan.monthly')}
                  className="mt-2 rounded-xl border border-[#D3E8DC] bg-[#F4FAF6] px-4 py-3 text-base text-pine"
                />
                {showInvalid ? (
                  <Text accessibilityRole="alert" className="mt-2 text-sm text-red-700">{t('mealPlan.invalid')}</Text>
                ) : null}
                <Text className="mt-3 text-sm text-pine">{t('mealPlan.weekly', { amount: money(weekly) })}</Text>
              </>
            )}
          </View>

          {phase === 'generating' ? (
            <View className="items-center gap-2 py-2">
              <ActivityIndicator color="#0B3D2E" />
              <Text className="text-center text-sm text-sage">{t('generating', { ns: 'health' })}</Text>
            </View>
          ) : null}

          {phase === 'error' ? (
            <Text accessibilityRole="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {t(`err.${errorCode}`, { ns: 'health', defaultValue: t('err.default', { ns: 'health' }) })}
            </Text>
          ) : null}
          {saveError ? (
            <Text accessibilityRole="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{saveError}</Text>
          ) : null}

          {phase === 'error' ? (
            <Pressable
              onPress={retry}
              disabled={locked || pendingWeekly === null}
              accessibilityRole="button"
              accessibilityState={{ disabled: locked || pendingWeekly === null }}
              className={`mt-5 items-center rounded-xl bg-mint py-3 ${locked ? 'opacity-50' : ''}`}
            >
              <Text className="font-bold text-pine">{t('mealPlan.retry')}</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => void saveAndGenerate()}
              disabled={generateDisabled}
              accessibilityRole="button"
              accessibilityState={{ disabled: generateDisabled }}
              className={`mt-4 items-center rounded-2xl bg-pine py-4 ${generateDisabled ? 'opacity-50' : ''}`}
            >
              <Text className="text-base font-bold text-white">{t('mealPlan.generate')}</Text>
            </Pressable>
          )}

          {phase === 'error' ? (
            <Pressable
              onPress={() => void leave()}
              disabled={leaveDisabled}
              accessibilityRole="button"
              accessibilityState={{ disabled: leaveDisabled }}
              className={`mt-4 items-center rounded-2xl bg-pine py-4 ${leaveDisabled ? 'opacity-50' : ''}`}
            >
              {leaveDisabled ? <ActivityIndicator color="white" /> : <Text className="text-base font-bold text-white">{t('mealPlan.continueWithout')}</Text>}
            </Pressable>
          ) : (
            <Pressable
              onPress={() => void leave()}
              disabled={locked}
              accessibilityRole="button"
              accessibilityState={{ disabled: locked }}
              className={`items-center p-3 text-sage ${locked ? 'opacity-50' : ''}`}
            >
              {finishing || submitting ? <ActivityIndicator color="#0B3D2E" /> : <Text className="text-sage">{t('mealPlan.skip')}</Text>}
            </Pressable>
          )}

          {phase === 'budget' || phase === 'error' ? (
            <Pressable
              onPress={onBack}
              disabled={leaveDisabled}
              accessibilityRole="button"
              accessibilityState={{ disabled: leaveDisabled }}
              className={`items-center p-3 text-sage ${leaveDisabled ? 'opacity-50' : ''}`}
            >
              <Text className="text-sage">{t('back')}</Text>
            </Pressable>
          ) : null}
        </>
      )}
    </View>
  );
}
