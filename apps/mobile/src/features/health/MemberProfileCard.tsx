import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { DIET_OPTIONS, GOAL_OPTIONS, LEVEL_OPTIONS, type HealthMember } from './types';

const splitList = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      className={`rounded-full border px-3 py-2 ${active ? 'border-pine bg-pine' : 'border-[#D3E8DC] bg-white'}`}
    >
      <Text className={`text-xs font-bold ${active ? 'text-white' : 'text-pine'}`}>{label}</Text>
    </Pressable>
  );
}

function Field({ label, hint, value, onChange, numeric }: { label: string; hint?: string; value: string; onChange: (v: string) => void; numeric?: boolean }) {
  return (
    <View className="gap-1">
      <Text className="text-xs font-bold uppercase tracking-wider text-sage">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={numeric ? 'number-pad' : 'default'}
        accessibilityLabel={label}
        className="rounded-xl border border-[#D3E8DC] bg-white px-3 py-2.5 text-sm text-pine"
      />
      {hint ? <Text className="text-[11px] text-sage">{hint}</Text> : null}
    </View>
  );
}

export default function MemberProfileCard({ member, onSaved }: { member: HealthMember; onSaved: () => void }) {
  const { t } = useTranslation('health');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [birthYear, setBirthYear] = useState(member.birth_year ? String(member.birth_year) : '');
  const [allergies, setAllergies] = useState(member.allergies.join(', '));
  const [diet, setDiet] = useState<string[]>(member.diet);
  const [likes, setLikes] = useState(member.likes.join(', '));
  const [dislikes, setDislikes] = useState(member.dislikes.join(', '));
  const [level, setLevel] = useState<string | null>(member.activity_level);
  const [activities, setActivities] = useState(member.activities.join(', '));
  const [goal, setGoal] = useState<string | null>(member.health_goal);
  const [notes, setNotes] = useState(member.notes ?? '');

  const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  const year = Number(birthYear);
  const yearValid = birthYear === '' || (Number.isInteger(year) && year >= 1900 && year <= new Date().getFullYear());

  const save = async () => {
    setSaving(true);
    setError(false);
    const { error: rpcError } = await supabase.rpc('f_upsert_member_health_profile', {
      p_member_id: member.member_id,
      p_profile: {
        birth_year: birthYear === '' ? null : year,
        allergies: splitList(allergies),
        diet,
        likes: splitList(likes),
        dislikes: splitList(dislikes),
        activity_level: level,
        activities: splitList(activities),
        health_goal: goal,
        notes: notes.trim() || null,
      },
    });
    setSaving(false);
    if (rpcError) {
      setError(true);
      return;
    }
    setEditing(false);
    onSaved();
  };

  const tags = [
    ...member.allergies.map((a) => ({ text: `⚠ ${a}`, warn: true })),
    ...member.diet.map((d) => ({ text: t(`diet.${d}`, { defaultValue: d }), warn: false })),
    ...(member.activity_level ? [{ text: `${t('activityLevel')}: ${t(`level.${member.activity_level}`)}`, warn: false }] : []),
    ...member.activities.map((a) => ({ text: a, warn: false })),
    ...(member.health_goal ? [{ text: t(`goal.${member.health_goal}`, { defaultValue: member.health_goal }), warn: false }] : []),
  ];

  return (
    <View className="rounded-2xl border border-[#E2EFE8] bg-[#F4FAF6] p-4" testID={`health-member-${member.member_id}`}>
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-2">
          <Text className="text-base font-extrabold text-pine">{member.name}</Text>
          <Text className="text-xs text-sage">
            {member.age !== null ? t('age', { age: member.age }) : member.has_profile ? '' : t('noProfile')}
          </Text>
        </View>
        {!editing ? (
          <Pressable onPress={() => setEditing(true)} accessibilityRole="button" className="rounded-full bg-white px-4 py-2">
            <Text className="text-xs font-bold text-pine">{t('edit')}</Text>
          </Pressable>
        ) : null}
      </View>

      {!editing ? (
        tags.length ? (
          <View className="mt-3 flex-row flex-wrap gap-2">
            {tags.map((tag, index) => (
              <View key={index} className={`rounded-full px-2.5 py-1 ${tag.warn ? 'bg-[#FDE8E6]' : 'bg-white'}`}>
                <Text className={`text-[11px] font-semibold ${tag.warn ? 'text-[#B53D35]' : 'text-pine'}`}>{tag.text}</Text>
              </View>
            ))}
          </View>
        ) : null
      ) : (
        <View className="mt-4 gap-4">
          <Field label={t('birthYear')} value={birthYear} onChange={setBirthYear} numeric />
          <Field label={t('allergies')} hint={t('allergiesHint')} value={allergies} onChange={setAllergies} />
          <View className="gap-2">
            <Text className="text-xs font-bold uppercase tracking-wider text-sage">{t('diet')}</Text>
            <View className="flex-row flex-wrap gap-2">
              {DIET_OPTIONS.map((option) => (
                <Chip key={option} label={t(`diet.${option}`)} active={diet.includes(option)} onPress={() => setDiet((d) => toggle(d, option))} />
              ))}
            </View>
          </View>
          <Field label={t('likes')} hint={t('listHint')} value={likes} onChange={setLikes} />
          <Field label={t('dislikes')} hint={t('listHint')} value={dislikes} onChange={setDislikes} />
          <View className="gap-2">
            <Text className="text-xs font-bold uppercase tracking-wider text-sage">{t('activityLevel')}</Text>
            <View className="flex-row flex-wrap gap-2">
              {LEVEL_OPTIONS.map((option) => (
                <Chip key={option} label={t(`level.${option}`)} active={level === option} onPress={() => setLevel(level === option ? null : option)} />
              ))}
            </View>
          </View>
          <Field label={t('activities')} hint={t('listHint')} value={activities} onChange={setActivities} />
          <View className="gap-2">
            <Text className="text-xs font-bold uppercase tracking-wider text-sage">{t('goal')}</Text>
            <View className="flex-row flex-wrap gap-2">
              {GOAL_OPTIONS.map((option) => (
                <Chip key={option} label={t(`goal.${option}`)} active={goal === option} onPress={() => setGoal(goal === option ? null : option)} />
              ))}
            </View>
          </View>
          <Field label={t('notes')} value={notes} onChange={setNotes} />
          {error ? <Text accessibilityRole="alert" className="text-xs text-red-700">{t('saveError')}</Text> : null}
          <View className="flex-row justify-end gap-2">
            <Pressable onPress={() => { setEditing(false); setError(false); }} disabled={saving} className="rounded-xl px-4 py-3">
              <Text className="text-sm font-bold text-sage">{t('cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={() => void save()}
              disabled={saving || !yearValid}
              accessibilityRole="button"
              className={`flex-row items-center rounded-xl bg-pine px-5 py-3 ${saving || !yearValid ? 'opacity-50' : ''}`}
            >
              {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
              <Text className="ml-1 text-sm font-bold text-white">{saving ? t('saving') : t('save')}</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}
