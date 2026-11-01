import '../health/i18n';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { loadHealthCatalog, valueLabel } from '../health/catalog';
import MemberProfileCard from '../health/MemberProfileCard';
import type { HealthContext, HealthMember, HealthOption } from '../health/types';

interface Props {
  householdId: string;
  finishing: boolean;
  onFinish: () => Promise<void>;
  onBack: () => void;
}

function distinctCount(members: HealthMember[], key: 'allergies' | 'conditions') {
  return new Set(members.flatMap((member) => member[key] ?? [])).size;
}

function sportsSummary(members: HealthMember[], catalog: HealthOption[], lang: string) {
  return members
    .filter((member) => (member.activities ?? []).length > 0)
    .map((member) => `${member.name}: ${(member.activities ?? []).map((code) => valueLabel(catalog, 'activity', code, lang).label).join(', ')}`)
    .join(' · ');
}

export default function HealthStep({ householdId, finishing, onFinish, onBack }: Props) {
  const { t, i18n } = useTranslation('onboarding');
  const [context, setContext] = useState<HealthContext | null>(null);
  const [catalog, setCatalog] = useState<HealthOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openEditors, setOpenEditors] = useState(0);
  const [autoOpenId, setAutoOpenId] = useState<string | null>(null);
  const loadSeq = useRef(0);
  const autoOpenChosen = useRef(false);
  const busy = loading || finishing;
  const members = context?.members ?? [];
  const lang = (i18n.language || 'es').slice(0, 2);
  const hasProfile = members.some((member) => member.has_profile);
  const sports = sportsSummary(members, catalog, lang);

  async function load() {
    const seq = ++loadSeq.current;
    setLoading(true);
    setLoadFailed(false);
    setError(null);
    try {
      const [result, options] = await Promise.all([
        supabase.rpc('f_get_family_health_context', { p_household_id: householdId }),
        loadHealthCatalog(),
      ]);
      if (seq !== loadSeq.current) return;
      if (result.error || result.data == null) throw result.error ?? new Error('empty');
      const data = result.data as unknown as HealthContext;
      if (!Array.isArray(data.members)) throw new Error('members');
      setContext(data);
      setCatalog(options);
      if (!autoOpenChosen.current) {
        autoOpenChosen.current = true;
        setAutoOpenId(data.members.find((member) => member.has_profile === false)?.member_id ?? null);
      }
    } catch {
      if (seq !== loadSeq.current) return;
      setLoadFailed(true);
      setError(t('health.loadError'));
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }

  function reload() {
    void load();
  }

  useEffect(() => { void load(); }, [householdId]);

  async function finish() {
    if (openEditors > 0) {
      setError(t('health.unsaved'));
      return;
    }
    setError(null);
    await onFinish();
  }

  return (
    <View className="mt-6 gap-4" testID="onboarding-health">
      <View className="flex-row items-start gap-3 rounded-2xl bg-white p-4">
        <Ionicons name="information-circle-outline" size={22} color="#0B3D2E" />
        <Text className="flex-1 text-sm leading-5 text-sage">{t('health.note')}</Text>
      </View>
      {loading ? <ActivityIndicator color="#0B3D2E" /> : null}
      {context ? (
        <View className="rounded-2xl bg-pine p-5">
          <Text className="text-sm font-bold text-white">{t('health.summaryTitle')}</Text>
          {hasProfile ? (
            <>
              <Text className="mt-2 text-sm leading-5 text-white">{t('health.summaryAllergies', { count: distinctCount(members, 'allergies') })}</Text>
              <Text className="mt-1 text-sm leading-5 text-white">{t('health.summaryConditions', { count: distinctCount(members, 'conditions') })}</Text>
              {sports ? <Text className="mt-1 text-sm leading-5 text-white">{t('health.summarySports', { list: sports })}</Text> : null}
            </>
          ) : (
            <Text className="mt-2 text-sm leading-5 text-white">{t('health.summaryEmpty')}</Text>
          )}
        </View>
      ) : null}
      {context ? members.map((member) => (
        <MemberProfileCard
          key={member.member_id}
          member={member}
          catalog={catalog}
          onSaved={() => reload()}
          startEditing={member.member_id === autoOpenId}
          onEditingChange={(editing) => setOpenEditors((n) => editing ? n + 1 : Math.max(0, n - 1))}
        />
      )) : null}
      {error ? <Text accessibilityRole="alert" className="text-sm text-red-700">{error}</Text> : null}
      {loadFailed ? (
        <Pressable onPress={() => void load()} accessibilityRole="button" className="p-3">
          <Text className="text-pine">{t('income.retry')}</Text>
        </Pressable>
      ) : null}
      <Pressable
        disabled={busy || loadFailed}
        onPress={() => void finish()}
        accessibilityRole="button"
        className={`mt-4 items-center rounded-2xl bg-pine py-4 ${busy || loadFailed ? 'opacity-50' : ''}`}
      >
        {finishing ? <ActivityIndicator color="white" /> : (
          <Text className="text-base font-bold text-white">{t(hasProfile ? 'continue' : 'health.skip')}</Text>
        )}
      </Pressable>
      <Pressable disabled={busy} onPress={onBack} accessibilityRole="button" className="items-center p-3">
        <Text className="font-semibold text-sage">{t('back')}</Text>
      </Pressable>
    </View>
  );
}
