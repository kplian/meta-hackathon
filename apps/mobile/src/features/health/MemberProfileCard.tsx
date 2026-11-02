import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { byKind, optionLabel, valueLabel } from './catalog';
import type { HealthMember, HealthOption, HealthOptionKind } from './types';

const sectionLabel = 'text-xs font-bold uppercase tracking-wider text-sage';
const fieldInput = 'rounded-xl border border-[#D3E8DC] bg-white px-3 py-2.5 text-sm text-pine';
const LIST_LIMIT = 20;
const TAG_LIMIT = 60;
const NOTES_LIMIT = 500;

type Props = {
  member: HealthMember;
  catalog: HealthOption[];
  onSaved: () => void;
  startEditing?: boolean;
  testID?: string;
  onEditingChange?: (editing: boolean) => void;
};

/** Empty input is null. Anything outside the range, or not a number, is invalid. */
function parseMeasure(raw: string, min: number, max: number, integer: boolean): number | null | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!(integer ? /^\d+$/ : /^\d+([.,]\d+)?$/).test(trimmed)) return undefined;
  const value = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(value) || value < min || value > max) return undefined;
  return value;
}

function measureToInput(value: number | null | undefined): string {
  return value == null ? '' : String(value);
}

function toggleValue(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function addValue(values: string[], raw: string): string[] {
  const value = raw.trim();
  if (!value || value.length > TAG_LIMIT || values.includes(value) || values.length >= LIST_LIMIT) return values;
  return [...values, value];
}

function formFrom(member: HealthMember) {
  return {
    birthYear: member.birth_year ? String(member.birth_year) : '',
    allergies: member.allergies ?? [],
    conditions: member.conditions ?? [],
    diet: member.diet ?? [],
    likes: member.likes ?? [],
    dislikes: member.dislikes ?? [],
    level: member.activity_level as string | null,
    activities: member.activities ?? [],
    goal: member.health_goal,
    weight: measureToInput(member.weight_kg),
    height: measureToInput(member.height_cm),
    notes: member.notes ?? '',
  };
}

function Field({
  label,
  value,
  onChange,
  keyboard = 'default',
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  keyboard?: 'default' | 'number-pad' | 'decimal-pad';
  maxLength?: number;
}) {
  return (
    <View className="gap-1">
      <Text className={sectionLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboard}
        maxLength={maxLength}
        accessibilityLabel={label}
        className={fieldInput}
      />
    </View>
  );
}

function CatalogChip({
  option,
  lang,
  active,
  role,
  onPress,
}: {
  option: HealthOption;
  lang: string;
  active: boolean;
  role: 'checkbox' | 'radio';
  onPress: () => void;
}) {
  const label = optionLabel(option, lang);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={role}
      accessibilityState={{ checked: active }}
      accessibilityLabel={label}
      className={`flex-row items-center gap-1 rounded-full border px-3 py-2 ${active ? 'border-pine bg-pine' : 'border-[#D3E8DC] bg-white'}`}
    >
      <Ionicons
        name={option.icon as ComponentProps<typeof Ionicons>['name']}
        size={14}
        color={active ? '#FFFFFF' : '#0B3D2E'}
      />
      <Text className={`text-xs font-bold ${active ? 'text-white' : 'text-pine'}`}>{label}</Text>
    </Pressable>
  );
}

function CustomChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  const { t } = useTranslation('health');
  return (
    <View className="flex-row items-center gap-1 rounded-full border border-pine bg-pine px-3 py-2">
      <Ionicons name="create-outline" size={14} color="#FFFFFF" />
      <Text className="text-xs font-bold text-white">{label}</Text>
      <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel={t('remove')} hitSlop={6}>
        <Ionicons name="close" size={14} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

function OtherField({
  label,
  onAdd,
  showLabel = true,
  atLimit = false,
}: {
  label: string;
  onAdd: (value: string) => void;
  showLabel?: boolean;
  atLimit?: boolean;
}) {
  const { t } = useTranslation('health');
  const [draft, setDraft] = useState('');
  const add = () => {
    if (atLimit) return;
    const value = draft.trim();
    if (!value) return;
    onAdd(value);
    setDraft('');
  };
  return (
    <View className="gap-1">
      {showLabel ? <Text className={sectionLabel}>{label}</Text> : null}
      <View className="flex-row items-center gap-2">
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={t('otherPlaceholder')}
          accessibilityLabel={label}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={TAG_LIMIT}
          onSubmitEditing={add}
          returnKeyType="done"
          className={`min-w-0 flex-1 ${fieldInput}`}
        />
        <Pressable
          onPress={add}
          disabled={atLimit || !draft.trim()}
          accessibilityRole="button"
          accessibilityLabel={t('add')}
          className={`rounded-xl bg-pine px-4 py-2.5 ${atLimit || !draft.trim() ? 'opacity-50' : ''}`}
        >
          <Text className="text-sm font-bold text-white">{t('add')}</Text>
        </Pressable>
      </View>
      {atLimit ? <Text accessibilityRole="alert" className="text-xs text-red-700">{t('tooMany')}</Text> : null}
    </View>
  );
}

function ChoiceGroup({
  label,
  note,
  kind,
  catalog,
  lang,
  values,
  onChange,
}: {
  label: string;
  note?: string;
  kind: HealthOptionKind;
  catalog: HealthOption[];
  lang: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const { t } = useTranslation('health');
  const options = byKind(catalog, kind);
  const codes = new Set(options.map((option) => option.code));
  const custom = values.filter((value) => !codes.has(value));
  return (
    <View className="gap-2">
      <Text className={sectionLabel}>{label}</Text>
      {note ? <Text className="text-[11px] text-sage">{note}</Text> : null}
      {options.length || custom.length ? (
        <View className="flex-row flex-wrap gap-2">
          {options.map((option) => (
            <CatalogChip
              key={option.code}
              option={option}
              lang={lang}
              active={values.includes(option.code)}
              role="checkbox"
              onPress={() => onChange(toggleValue(values, option.code))}
            />
          ))}
          {custom.map((value) => (
            <CustomChip key={value} label={value} onRemove={() => onChange(values.filter((item) => item !== value))} />
          ))}
        </View>
      ) : null}
      <OtherField label={t('other')} atLimit={values.length >= LIST_LIMIT} onAdd={(value) => onChange(addValue(values, value))} />
    </View>
  );
}

function FreeList({ label, values, onChange }: { label: string; values: string[]; onChange: (values: string[]) => void }) {
  return (
    <View className="gap-2">
      <Text className={sectionLabel}>{label}</Text>
      {values.length ? (
        <View className="flex-row flex-wrap gap-2">
          {values.map((value) => (
            <CustomChip key={value} label={value} onRemove={() => onChange(values.filter((item) => item !== value))} />
          ))}
        </View>
      ) : null}
      <OtherField label={label} showLabel={false} atLimit={values.length >= LIST_LIMIT} onAdd={(value) => onChange(addValue(values, value))} />
    </View>
  );
}

function SingleChoice({
  label,
  kind,
  catalog,
  lang,
  value,
  onChange,
}: {
  label: string;
  kind: HealthOptionKind;
  catalog: HealthOption[];
  lang: string;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const options = byKind(catalog, kind);
  return (
    <View className="gap-2">
      <Text className={sectionLabel}>{label}</Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map((option) => (
          <CatalogChip
            key={option.code}
            option={option}
            lang={lang}
            active={value === option.code}
            role="radio"
            onPress={() => onChange(value === option.code ? null : option.code)}
          />
        ))}
      </View>
    </View>
  );
}

function ReadChip({
  catalog,
  kind,
  value,
  lang,
  tone,
}: {
  catalog: HealthOption[];
  kind: HealthOptionKind;
  value: string;
  lang: string;
  tone: 'allergy' | 'condition' | 'plain';
}) {
  const info = valueLabel(catalog, kind, value, lang);
  const allergy = tone === 'allergy';
  const color = allergy ? '#B53D35' : '#0B3D2E';
  const bg = allergy ? 'bg-[#FDE8E6]' : tone === 'condition' ? 'bg-[#FFF4E0]' : 'bg-white';
  const text = allergy ? 'text-[#B53D35]' : 'text-pine';
  return (
    <View className={`flex-row items-center gap-1 rounded-full px-2.5 py-1 ${bg}`}>
      {allergy ? <Ionicons name="warning-outline" size={12} color={color} /> : null}
      <Ionicons name={info.icon as ComponentProps<typeof Ionicons>['name']} size={12} color={color} />
      <Text className={`text-[11px] font-semibold ${text}`}>{info.label}</Text>
    </View>
  );
}

export default function MemberProfileCard({ member, catalog, onSaved, startEditing, testID, onEditingChange }: Props) {
  const { t, i18n } = useTranslation('health');
  const lang = (i18n.language || 'es').slice(0, 2);
  const onEditingChangeRef = useRef(onEditingChange);
  onEditingChangeRef.current = onEditingChange;
  const editingRef = useRef(startEditing ?? false);

  const initial = formFrom(member);
  const [editing, setEditing] = useState(startEditing ?? false);
  editingRef.current = editing;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [birthYear, setBirthYear] = useState(initial.birthYear);
  const [allergies, setAllergies] = useState(initial.allergies);
  const [conditions, setConditions] = useState(initial.conditions);
  const [diet, setDiet] = useState(initial.diet);
  const [likes, setLikes] = useState(initial.likes);
  const [dislikes, setDislikes] = useState(initial.dislikes);
  const [level, setLevel] = useState<string | null>(initial.level);
  const [activities, setActivities] = useState(initial.activities);
  const [goal, setGoal] = useState<string | null>(initial.goal);
  const [weight, setWeight] = useState(initial.weight);
  const [height, setHeight] = useState(initial.height);
  const [notes, setNotes] = useState(initial.notes);

  const applyForm = useCallback((source: HealthMember) => {
    const next = formFrom(source);
    setBirthYear(next.birthYear);
    setAllergies(next.allergies);
    setConditions(next.conditions);
    setDiet(next.diet);
    setLikes(next.likes);
    setDislikes(next.dislikes);
    setLevel(next.level);
    setActivities(next.activities);
    setGoal(next.goal);
    setWeight(next.weight);
    setHeight(next.height);
    setNotes(next.notes);
  }, []);

  useEffect(() => {
    if (startEditing) onEditingChangeRef.current?.(true);
    return () => {
      if (editingRef.current) onEditingChangeRef.current?.(false);
    };
  }, [startEditing]);

  // The card remounts when refresh bumps, before the new profile arrives.
  // Catch up once `member` updates so the next edit does not save stale nulls.
  useEffect(() => {
    if (!editing) applyForm(member);
  }, [applyForm, editing, member]);

  const changeEditing = (next: boolean) => {
    editingRef.current = next;
    setEditing(next);
    onEditingChangeRef.current?.(next);
  };

  const yearMax = new Date().getFullYear();
  const birthYearValue = parseMeasure(birthYear, 1900, yearMax, true);
  const weightValue = parseMeasure(weight, 2, 400, false);
  const heightValue = parseMeasure(height, 40, 250, false);
  const numbersValid = birthYearValue !== undefined && weightValue !== undefined && heightValue !== undefined;

  const cancel = () => {
    applyForm(member);
    setMoreOpen(false);
    setError(false);
    changeEditing(false);
  };

  const save = async () => {
    if (birthYearValue === undefined || weightValue === undefined || heightValue === undefined) return;
    setSaving(true);
    setError(false);
    const { error: rpcError } = await supabase.rpc('f_upsert_member_health_profile', {
      p_member_id: member.member_id,
      p_profile: {
        birth_year: birthYearValue,
        allergies,
        conditions,
        diet,
        likes,
        dislikes,
        activity_level: level,
        activities,
        health_goal: goal,
        weight_kg: weightValue,
        height_cm: heightValue,
        notes: notes.trim() || null,
      },
    });
    setSaving(false);
    if (rpcError) {
      setError(true);
      return;
    }
    changeEditing(false);
    onSaved();
  };

  const readTags: { kind: HealthOptionKind; value: string; tone: 'allergy' | 'condition' | 'plain' }[] = [
    ...(member.allergies ?? []).map((value) => ({ kind: 'allergen' as const, value, tone: 'allergy' as const })),
    ...(member.conditions ?? []).map((value) => ({ kind: 'condition' as const, value, tone: 'condition' as const })),
    ...(member.diet ?? []).map((value) => ({ kind: 'diet' as const, value, tone: 'plain' as const })),
    ...(member.activity_level ? [{ kind: 'activity_level' as const, value: member.activity_level, tone: 'plain' as const }] : []),
    ...(member.activities ?? []).map((value) => ({ kind: 'activity' as const, value, tone: 'plain' as const })),
    ...(member.health_goal ? [{ kind: 'goal' as const, value: member.health_goal, tone: 'plain' as const }] : []),
  ];

  return (
    <View className="rounded-2xl border border-[#E2EFE8] bg-[#F4FAF6] p-4" testID={testID ?? `health-member-${member.member_id}`}>
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-2">
          <Text className="text-base font-extrabold text-pine">{member.name}</Text>
          <Text className="text-xs text-sage">
            {member.age !== null ? t('age', { age: member.age }) : member.has_profile ? '' : t('noProfile')}
          </Text>
        </View>
        {!editing ? (
          <Pressable onPress={() => changeEditing(true)} accessibilityRole="button" className="rounded-full bg-white px-4 py-2">
            <Text className="text-xs font-bold text-pine">{member.has_profile ? t('edit') : t('complete')}</Text>
          </Pressable>
        ) : null}
      </View>

      {!editing ? (
        readTags.length ? (
          <View className="mt-3 flex-row flex-wrap gap-2">
            {readTags.map((tag) => (
              <ReadChip key={`${tag.kind}-${tag.value}`} catalog={catalog} kind={tag.kind} value={tag.value} lang={lang} tone={tag.tone} />
            ))}
          </View>
        ) : null
      ) : (
        <View className="mt-4 gap-4">
          <ChoiceGroup label={t('allergies')} note={t('allergiesNote')} kind="allergen" catalog={catalog} lang={lang} values={allergies} onChange={setAllergies} />
          <ChoiceGroup label={t('conditions')} kind="condition" catalog={catalog} lang={lang} values={conditions} onChange={setConditions} />
          <ChoiceGroup label={t('diet')} kind="diet" catalog={catalog} lang={lang} values={diet} onChange={setDiet} />
          <Pressable
            onPress={() => setMoreOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityState={{ expanded: moreOpen }}
            className="flex-row items-center gap-1 self-start py-1"
          >
            <Ionicons name={moreOpen ? 'chevron-up' : 'chevron-down'} size={16} color="#0B3D2E" />
            <Text className="text-sm font-bold text-pine">{moreOpen ? t('lessDetails') : t('moreDetails')}</Text>
          </Pressable>
          {moreOpen ? (
            <View className="gap-4">
              <FreeList label={t('likes')} values={likes} onChange={setLikes} />
              <FreeList label={t('dislikes')} values={dislikes} onChange={setDislikes} />
              <SingleChoice label={t('activityLevel')} kind="activity_level" catalog={catalog} lang={lang} value={level} onChange={setLevel} />
              <ChoiceGroup label={t('activities')} kind="activity" catalog={catalog} lang={lang} values={activities} onChange={setActivities} />
              <SingleChoice label={t('goal')} kind="goal" catalog={catalog} lang={lang} value={goal} onChange={setGoal} />
              <Field label={t('birthYear')} value={birthYear} onChange={setBirthYear} keyboard="number-pad" />
              <Field label={t('weight')} value={weight} onChange={setWeight} keyboard="decimal-pad" />
              <Field label={t('height')} value={height} onChange={setHeight} keyboard="decimal-pad" />
              <Field label={t('notes')} value={notes} onChange={setNotes} maxLength={NOTES_LIMIT} />
            </View>
          ) : null}
          <Text className="text-[11px] text-sage">{t('privacy')}</Text>
          {!numbersValid ? (
            <Text accessibilityRole="alert" className="text-xs text-red-700">{t('invalidNumber')}</Text>
          ) : null}
          {error ? (
            <Text accessibilityRole="alert" className="text-xs text-red-700">{t('saveError')}</Text>
          ) : null}
          <View className="flex-row justify-end gap-2">
            <Pressable onPress={cancel} disabled={saving} accessibilityRole="button" className="rounded-xl px-4 py-3">
              <Text className="text-sm font-bold text-sage">{t('cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={() => void save()}
              disabled={saving || !numbersValid}
              accessibilityRole="button"
              className={`flex-row items-center rounded-xl bg-pine px-5 py-3 ${saving || !numbersValid ? 'opacity-50' : ''}`}
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
