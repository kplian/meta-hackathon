import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { COMMON_CONSTANTS, HOUSEHOLDS_CONSTANTS } from '../i18n/constants';
import type {
  AuxiliarRow,
  BusinessTypeRow,
  HouseholdMemberRow,
  HouseholdRow,
  UserRow,
} from '../lib/budget-schema';

interface HouseholdsViewProps {
  currentUserId: string;
  onHouseholdsChanged?: () => void;
}

const CURRENCY_OPTIONS = ['BOB', 'USD', 'CLP', 'EUR'] as const;
const MEMBER_ROLE_OPTIONS = ['admin', 'member'] as const;
const MEMBER_TYPE_OPTIONS = ['dad', 'mom', 'son', 'other'] as const;

export default function HouseholdsView({
  currentUserId,
  onHouseholdsChanged,
}: HouseholdsViewProps) {
  const { t } = useTranslation();
  const [households, setHouseholds] = useState<HouseholdRow[]>([]);
  const [businessTypes, setBusinessTypes] = useState<BusinessTypeRow[]>([]);
  const [auxiliars, setAuxiliars] = useState<AuxiliarRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [loadingHouseholds, setLoadingHouseholds] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Create / Edit Household modal state
  const [isHouseholdModalOpen, setIsHouseholdModalOpen] = useState(false);
  const [editingHousehold, setEditingHousehold] = useState<HouseholdRow | null>(null);
  const [businessTypeId, setBusinessTypeId] = useState<string>('');
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('BOB');
  const [auxiliarId, setAuxiliarId] = useState<string | null>(null);
  const [preferencesText, setPreferencesText] = useState('{}');
  const [openHhDropdown, setOpenHhDropdown] = useState<'business_type' | 'auxiliar' | null>(null);
  const [savingHousehold, setSavingHousehold] = useState(false);
  const [householdFormError, setHouseholdFormError] = useState<string | null>(null);

  // Logical Delete Household confirmation modal state
  const [householdToDelete, setHouseholdToDelete] = useState<HouseholdRow | null>(null);
  const [deletingHousehold, setDeletingHousehold] = useState(false);
  const [deleteHouseholdError, setDeleteHouseholdError] = useState<string | null>(null);

  // Members Sub-View state (budget.thousehold_member)
  const [selectedHouseholdForMembers, setSelectedHouseholdForMembers] =
    useState<HouseholdRow | null>(null);
  const [members, setMembers] = useState<HouseholdMemberRow[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');

  // Create / Edit Member modal state
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<HouseholdMemberRow | null>(null);
  const [memberUserId, setMemberUserId] = useState<string>('');
  const [memberRole, setMemberRole] = useState<'admin' | 'member'>('member');
  const [memberType, setMemberType] = useState<'dad' | 'mom' | 'son' | 'other'>('other');
  const [memberAuxiliarId, setMemberAuxiliarId] = useState<string | null>(null);
  const [memberPreferencesText, setMemberPreferencesText] = useState('{}');
  const [openMemberDropdown, setOpenMemberDropdown] = useState<'user' | 'auxiliar' | null>(null);
  const [savingMember, setSavingMember] = useState(false);
  const [memberFormError, setMemberFormError] = useState<string | null>(null);

  // Logical Delete Member confirmation modal state
  const [memberToDelete, setMemberToDelete] = useState<HouseholdMemberRow | null>(null);
  const [deletingMember, setDeletingMember] = useState(false);
  const [deleteMemberError, setDeleteMemberError] = useState<string | null>(null);

  // Resolve valid actor user ID in budget.tuser for audit columns
  const resolveActorUserId = async (): Promise<string | null> => {
    const { data } = await supabase
      .schema('budget')
      .from('tuser')
      .select('id')
      .eq('id', currentUserId)
      .maybeSingle();
    if (data?.id) return data.id;

    const { data: fallbackUser } = await supabase
      .schema('budget')
      .from('tuser')
      .select('id')
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();
    return fallbackUser?.id ?? null;
  };

  // Load households, business types, auxiliars, users, and member counts
  const loadHouseholdsData = async () => {
    setLoadingHouseholds(true);
    try {
      const [hhRes, bizRes, auxRes, usrRes, memRes] = await Promise.all([
        supabase
          .schema('budget')
          .from('thousehold')
          .select('*')
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
        supabase
          .schema('budget')
          .from('tbusiness_type')
          .select('*')
          .is('deleted_at', null)
          .order('name', { ascending: true }),
        supabase
          .schema('budget')
          .from('tauxiliar')
          .select('*')
          .is('deleted_at', null)
          .order('name', { ascending: true }),
        supabase
          .schema('budget')
          .from('tuser')
          .select('*')
          .is('deleted_at', null)
          .order('full_name', { ascending: true }),
        supabase
          .schema('budget')
          .from('thousehold_member')
          .select('id, household_id')
          .is('deleted_at', null),
      ]);

      setHouseholds(hhRes.data ?? []);
      setBusinessTypes(bizRes.data ?? []);
      setAuxiliars(auxRes.data ?? []);
      setUsers(usrRes.data ?? []);

      if (memRes.data) {
        const counts: Record<string, number> = {};
        for (const m of memRes.data) {
          counts[m.household_id] = (counts[m.household_id] ?? 0) + 1;
        }
        setMemberCounts(counts);
      }
    } finally {
      setLoadingHouseholds(false);
    }
  };

  // Load active non-deleted members for a specific household
  const loadHouseholdMembers = async (householdId: string) => {
    setLoadingMembers(true);
    try {
      const { data } = await supabase
        .schema('budget')
        .from('thousehold_member')
        .select('*')
        .eq('household_id', householdId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      const list = data ?? [];
      setMembers(list);
      setMemberCounts((prev) => ({
        ...prev,
        [householdId]: list.length,
      }));
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    void loadHouseholdsData();
  }, []);

  useEffect(() => {
    if (selectedHouseholdForMembers) {
      void loadHouseholdMembers(selectedHouseholdForMembers.id);
    }
  }, [selectedHouseholdForMembers?.id]);

  const businessTypeMap = useMemo(
    () => new Map(businessTypes.map((b) => [b.id, b])),
    [businessTypes],
  );
  const auxiliarMap = useMemo(
    () => new Map(auxiliars.map((a) => [a.id, a])),
    [auxiliars],
  );
  const userMap = useMemo(
    () => new Map(users.map((u) => [u.id, u])),
    [users],
  );

  // Filtered households
  const filteredHouseholds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return households;
    return households.filter((h) => {
      const bizName = businessTypeMap.get(h.business_type_id)?.name || '';
      return (
        h.name.toLowerCase().includes(q) ||
        (h.currency ?? '').toLowerCase().includes(q) ||
        bizName.toLowerCase().includes(q)
      );
    });
  }, [households, searchQuery, businessTypeMap]);

  // Filtered members
  const filteredMembers = useMemo(() => {
    const q = memberSearchQuery.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => {
      const usr = userMap.get(m.user_id);
      const usrText = usr ? `${usr.full_name} ${usr.email_user}` : '';
      return (
        usrText.toLowerCase().includes(q) ||
        (m.role ?? '').toLowerCase().includes(q) ||
        m.member_type.toLowerCase().includes(q)
      );
    });
  }, [members, memberSearchQuery, userMap]);

  // Open Create Household modal
  const handleOpenCreateHousehold = () => {
    setEditingHousehold(null);
    setBusinessTypeId(businessTypes[0]?.id ?? '');
    setName('');
    setCurrency('BOB');
    setAuxiliarId(null);
    setPreferencesText('{}');
    setOpenHhDropdown(null);
    setHouseholdFormError(null);
    setIsHouseholdModalOpen(true);
  };

  // Open Edit Household modal
  const handleOpenEditHousehold = (hh: HouseholdRow) => {
    setEditingHousehold(hh);
    setBusinessTypeId(hh.business_type_id);
    setName(hh.name);
    setCurrency(hh.currency?.trim() || 'BOB');
    setAuxiliarId(hh.auxiliar_id ?? null);
    setPreferencesText(
      typeof hh.preferences === 'string'
        ? hh.preferences
        : JSON.stringify(hh.preferences ?? {}),
    );
    setOpenHhDropdown(null);
    setHouseholdFormError(null);
    setIsHouseholdModalOpen(true);
  };

  // Save Household (Create or Update)
  const handleSaveHousehold = async () => {
    setHouseholdFormError(null);
    if (!businessTypeId) {
      setHouseholdFormError('Selecciona un Business Type del desplegable.');
      return;
    }
    if (!name.trim()) {
      setHouseholdFormError('El nombre del hogar es obligatorio.');
      return;
    }

    let parsedPrefs: Record<string, unknown> = {};
    try {
      parsedPrefs = JSON.parse(preferencesText.trim() || '{}') as Record<string, unknown>;
    } catch {
      setHouseholdFormError('El campo preferences debe ser un JSON válido (ej. {}).');
      return;
    }

    setSavingHousehold(true);
    try {
      const actorId = await resolveActorUserId();

      if (editingHousehold) {
        const { error } = await supabase
          .schema('budget')
          .from('thousehold')
          .update({
            business_type_id: businessTypeId,
            name: name.trim(),
            currency: currency.trim() || 'BOB',
            auxiliar_id: auxiliarId || null,
            preferences: parsedPrefs as never,
            updated_at: new Date().toISOString(),
            updated_by: actorId,
          })
          .eq('id', editingHousehold.id);

        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .schema('budget')
          .from('thousehold')
          .insert({
            business_type_id: businessTypeId,
            name: name.trim(),
            currency: currency.trim() || 'BOB',
            auxiliar_id: auxiliarId || null,
            preferences: parsedPrefs as never,
            status: 'active',
            created_by: actorId,
          });

        if (error) throw new Error(error.message);
      }

      setIsHouseholdModalOpen(false);
      await loadHouseholdsData();
      onHouseholdsChanged?.();
    } catch (err) {
      setHouseholdFormError(
        err instanceof Error ? err.message : 'Error al guardar el hogar',
      );
    } finally {
      setSavingHousehold(false);
    }
  };

  // Confirm logical deletion of Household
  const handleConfirmDeleteHousehold = async () => {
    if (!householdToDelete) return;
    setDeletingHousehold(true);
    setDeleteHouseholdError(null);
    try {
      const actorId = await resolveActorUserId();
      const { error } = await supabase
        .schema('budget')
        .from('thousehold')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: actorId,
          status: 'inactive',
        })
        .eq('id', householdToDelete.id);

      if (error) throw new Error(error.message);

      setHouseholdToDelete(null);
      await loadHouseholdsData();
      onHouseholdsChanged?.();
    } catch (err) {
      setDeleteHouseholdError(
        err instanceof Error ? err.message : 'No se pudo eliminar el hogar',
      );
    } finally {
      setDeletingHousehold(false);
    }
  };

  // Open Create Member modal
  const handleOpenCreateMember = () => {
    setEditingMember(null);
    setMemberUserId(users[0]?.id ?? '');
    setMemberRole('member');
    setMemberType('other');
    setMemberAuxiliarId(null);
    setMemberPreferencesText('{}');
    setOpenMemberDropdown(null);
    setMemberFormError(null);
    setIsMemberModalOpen(true);
  };

  // Open Edit Member modal
  const handleOpenEditMember = (mem: HouseholdMemberRow) => {
    setEditingMember(mem);
    setMemberUserId(mem.user_id);
    setMemberRole(mem.role === 'admin' ? 'admin' : 'member');
    setMemberType(
      mem.member_type === 'dad' || mem.member_type === 'mom' || mem.member_type === 'son'
        ? mem.member_type
        : 'other',
    );
    setMemberAuxiliarId(mem.auxiliar_id ?? null);
    setMemberPreferencesText(
      typeof mem.preferences === 'string'
        ? mem.preferences
        : JSON.stringify(mem.preferences ?? {}),
    );
    setOpenMemberDropdown(null);
    setMemberFormError(null);
    setIsMemberModalOpen(true);
  };

  // Save Member (Create or Update in budget.thousehold_member)
  const handleSaveMember = async () => {
    if (!selectedHouseholdForMembers) return;
    setMemberFormError(null);

    if (!memberUserId) {
      setMemberFormError('Selecciona un usuario (user_id) del desplegable.');
      return;
    }

    let parsedPrefs: Record<string, unknown> = {};
    try {
      parsedPrefs = JSON.parse(memberPreferencesText.trim() || '{}') as Record<string, unknown>;
    } catch {
      setMemberFormError('El campo preferences debe ser un JSON válido (ej. {}).');
      return;
    }

    setSavingMember(true);
    try {
      const actorId = await resolveActorUserId();

      if (editingMember) {
        const { error } = await supabase
          .schema('budget')
          .from('thousehold_member')
          .update({
            user_id: memberUserId,
            role: memberRole,
            member_type: memberType,
            auxiliar_id: memberAuxiliarId || null,
            preferences: parsedPrefs as never,
            updated_at: new Date().toISOString(),
            updated_by: actorId,
          })
          .eq('id', editingMember.id);

        if (error) throw new Error(error.message);
      } else {
        // Check if a soft-deleted row already exists for (household_id, user_id)
        const { data: existingRow } = await supabase
          .schema('budget')
          .from('thousehold_member')
          .select('id')
          .eq('household_id', selectedHouseholdForMembers.id)
          .eq('user_id', memberUserId)
          .maybeSingle();

        if (existingRow?.id) {
          const { error } = await supabase
            .schema('budget')
            .from('thousehold_member')
            .update({
              role: memberRole,
              member_type: memberType,
              auxiliar_id: memberAuxiliarId || null,
              preferences: parsedPrefs as never,
              status: 'active',
              deleted_at: null,
              deleted_by: null,
              updated_at: new Date().toISOString(),
              updated_by: actorId,
            })
            .eq('id', existingRow.id);

          if (error) throw new Error(error.message);
        } else {
          const { error } = await supabase
            .schema('budget')
            .from('thousehold_member')
            .insert({
              household_id: selectedHouseholdForMembers.id,
              user_id: memberUserId,
              role: memberRole,
              member_type: memberType,
              auxiliar_id: memberAuxiliarId || null,
              preferences: parsedPrefs as never,
              status: 'active',
              created_by: actorId,
            });

          if (error) throw new Error(error.message);
        }
      }

      setIsMemberModalOpen(false);
      await loadHouseholdMembers(selectedHouseholdForMembers.id);
      onHouseholdsChanged?.();
    } catch (err) {
      setMemberFormError(err instanceof Error ? err.message : 'Error al guardar el miembro');
    } finally {
      setSavingMember(false);
    }
  };

  // Confirm logical deletion of Member
  const handleConfirmDeleteMember = async () => {
    if (!memberToDelete || !selectedHouseholdForMembers) return;
    setDeletingMember(true);
    setDeleteMemberError(null);
    try {
      const actorId = await resolveActorUserId();
      const { error } = await supabase
        .schema('budget')
        .from('thousehold_member')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: actorId,
          status: 'inactive',
        })
        .eq('id', memberToDelete.id);

      if (error) throw new Error(error.message);

      setMemberToDelete(null);
      await loadHouseholdMembers(selectedHouseholdForMembers.id);
      onHouseholdsChanged?.();
    } catch (err) {
      setDeleteMemberError(
        err instanceof Error ? err.message : 'No se pudo eliminar el miembro',
      );
    } finally {
      setDeletingMember(false);
    }
  };

  const selectedModalBusinessType = businessTypeMap.get(businessTypeId);
  const selectedModalAuxiliar = auxiliarId ? auxiliarMap.get(auxiliarId) : null;
  const selectedModalUser = memberUserId ? userMap.get(memberUserId) : null;
  const selectedModalMemberAux = memberAuxiliarId ? auxiliarMap.get(memberAuxiliarId) : null;

  // ============================================================================
  // HOUSEHOLD MEMBERS SUB-INTERFACE (budget.thousehold_member)
  // ============================================================================
  if (selectedHouseholdForMembers) {
    const parentBizType = businessTypeMap.get(selectedHouseholdForMembers.business_type_id);

    return (
      <View className="relative flex-1 bg-[#F2F8F4]">
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-4 pt-3 pb-28 max-w-5xl w-full self-center"
        >
          {/* Back Navigation + Table Badge */}
          <View className="mb-3 flex-row items-center justify-between">
            <Pressable
              onPress={() => {
                setSelectedHouseholdForMembers(null);
                setMemberSearchQuery('');
              }}
              className="flex-row items-center rounded-full bg-[#DCECE3] px-3.5 py-2 active:bg-[#CBE2D5]"
            >
              <Ionicons name="arrow-back" size={16} color="#0B3D2E" />
              <Text className="ml-1.5 text-[13px] font-bold text-pine">
                {t(HOUSEHOLDS_CONSTANTS.BACK_TO_HOUSEHOLDS)}
              </Text>
            </Pressable>

            <View className="rounded-full bg-[#E6F4EC] px-3 py-1">
              <Text className="text-[11px] font-extrabold text-pine">
                budget.thousehold_member • {members.length}{' '}
                {members.length === 1
                  ? t(HOUSEHOLDS_CONSTANTS.MEMBER_SINGULAR)
                  : t(HOUSEHOLDS_CONSTANTS.MEMBER_PLURAL)}
              </Text>
            </View>
          </View>

          {/* Selected Household Context Banner */}
          <View className="mb-4 rounded-3xl bg-white p-4 shadow-sm border border-[#E5F0EA] flex-row items-center justify-between">
            <View className="flex-row items-center flex-1">
              <View className="h-11 w-11 items-center justify-center rounded-full bg-pine">
                <Ionicons name="home-outline" size={20} color="#FFFFFF" />
              </View>
              <View className="ml-3 flex-1">
                <View className="flex-row items-center flex-wrap gap-1.5">
                  <Text className="text-[11px] font-extrabold uppercase tracking-wider text-[#5A6D64]">
                    {t(HOUSEHOLDS_CONSTANTS.MEMBERS_HEADER)}
                  </Text>
                  <View className="rounded-full bg-[#DFF5E8] px-2 py-0.5">
                    <Text className="text-[10px] font-extrabold text-[#0B3D2E]">
                      {selectedHouseholdForMembers.currency ?? 'BOB'}
                    </Text>
                  </View>
                  {parentBizType ? (
                    <View className="rounded-full bg-[#E3ECE7] px-2 py-0.5">
                      <Text className="text-[10px] font-bold text-[#3B4F46]">
                        {parentBizType.name}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text className="text-[16px] font-extrabold text-[#12211B]" numberOfLines={1}>
                  {selectedHouseholdForMembers.name}
                </Text>
              </View>
            </View>
          </View>

          {/* Search Input + Refresh */}
          <View className="flex-row items-center gap-2.5 mb-4">
            <View className="flex-1 flex-row items-center rounded-2xl bg-white px-4 py-3 shadow-sm border border-[#E5F0EA]">
              <Ionicons name="search-outline" size={20} color="#7A8C83" />
              <TextInput
                value={memberSearchQuery}
                onChangeText={setMemberSearchQuery}
                placeholder={t(HOUSEHOLDS_CONSTANTS.SEARCH_MEMBER_PLACEHOLDER)}
                placeholderTextColor="#7A8C83"
                className="ml-2.5 flex-1 text-[15px] text-pine"
              />
              {memberSearchQuery ? (
                <Pressable onPress={() => setMemberSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color="#9BA8A2" />
                </Pressable>
              ) : null}
            </View>

            <Pressable
              onPress={() => void loadHouseholdMembers(selectedHouseholdForMembers.id)}
              className="h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm border border-[#E5F0EA] active:bg-[#E8F4ED]"
              accessibilityLabel={t(COMMON_CONSTANTS.REFRESH)}
            >
              <Ionicons name="refresh" size={20} color="#0B3D2E" />
            </Pressable>
          </View>

          {/* Members Cards List */}
          {loadingMembers ? (
            <View className="py-10 items-center">
              <ActivityIndicator size="large" color="#0B3D2E" />
            </View>
          ) : filteredMembers.length === 0 ? (
            <View className="mt-2 items-center rounded-3xl bg-white p-8 shadow-sm border border-[#E5F0EA]">
              <Ionicons name="people-outline" size={36} color="#9BA8A2" />
              <Text className="mt-3 text-[15px] font-bold text-[#12211B]">
                {t(HOUSEHOLDS_CONSTANTS.EMPTY_MEMBERS_TITLE)}
              </Text>
              <Text className="mt-1 text-center text-[13px] text-[#5A6D64]">
                {t(HOUSEHOLDS_CONSTANTS.EMPTY_MEMBERS_DESC, {
                  name: selectedHouseholdForMembers.name,
                })}
              </Text>
            </View>
          ) : (
            <View className="gap-2.5">
              {filteredMembers.map((mem) => {
                const usr = userMap.get(mem.user_id);
                const aux = mem.auxiliar_id ? auxiliarMap.get(mem.auxiliar_id) : undefined;
                const isAdmin = mem.role === 'admin';
                const roleBadgeStyle = isAdmin
                  ? 'bg-[#DFF5E8] text-[#0B3D2E]'
                  : 'bg-[#E3ECE7] text-[#3B4F46]';

                return (
                  <View
                    key={mem.id}
                    className="flex-row items-center justify-between rounded-3xl bg-white px-4 py-3.5 shadow-sm border border-[#E7F1EC]"
                  >
                    {/* Left Avatar + Member Info */}
                    <View className="flex-row items-center flex-1 mr-2">
                      <View
                        className="h-12 w-12 items-center justify-center rounded-full"
                        style={{ backgroundColor: '#E6F4EC' }}
                      >
                        <Ionicons name="person-outline" size={22} color="#0B3D2E" />
                      </View>

                      <View className="ml-3 flex-1">
                        <View className="flex-row items-center flex-wrap gap-1.5">
                          <Text
                            className="text-[15px] font-extrabold text-[#12211B]"
                            numberOfLines={1}
                          >
                            {usr ? usr.full_name : mem.user_id}
                          </Text>

                          <View className={`rounded-full px-2.5 py-0.5 ${roleBadgeStyle}`}>
                            <Text className="text-[10px] font-extrabold uppercase">
                              {mem.role ?? 'member'}
                            </Text>
                          </View>

                          <View className="rounded-full bg-[#FFF1E6] px-2.5 py-0.5">
                            <Text className="text-[10px] font-extrabold uppercase text-[#9A4B1A]">
                              {mem.member_type}
                            </Text>
                          </View>

                          {aux ? (
                            <View className="rounded-full bg-[#E8F4ED] px-2.5 py-0.5">
                              <Text className="text-[10px] font-bold text-pine">
                                Aux: {aux.code}
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        <View className="mt-1 flex-row items-center">
                          <View className="h-4 w-4 items-center justify-center rounded-full bg-[#D9EBE0]">
                            <Text className="text-[8px] font-extrabold text-pine">
                              {((usr?.full_name ?? 'M')[0] ?? 'M').toUpperCase()}
                            </Text>
                          </View>
                          <Text
                            className="ml-1.5 text-[12px] font-medium text-[#5A6D64] flex-1"
                            numberOfLines={1}
                          >
                            {usr?.email_user ?? mem.user_id}
                            {aux ? ` • ${aux.name}` : ''}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Right Flat Action Icons: Edit & Delete */}
                    <View className="flex-row items-center gap-1.5">
                      <Pressable
                        onPress={() => handleOpenEditMember(mem)}
                        className="h-9 w-9 items-center justify-center rounded-full bg-[#F2F8F4] active:bg-[#DCECE3]"
                        accessibilityLabel={t(COMMON_CONSTANTS.EDIT)}
                      >
                        <Feather name="edit-2" size={16} color="#0B3D2E" />
                      </Pressable>

                      <Pressable
                        onPress={() => {
                          setDeleteMemberError(null);
                          setMemberToDelete(mem);
                        }}
                        className="h-9 w-9 items-center justify-center rounded-full bg-[#FFF5F5] active:bg-[#FED7D7]"
                        accessibilityLabel={t(COMMON_CONSTANTS.DELETE)}
                      >
                        <Feather name="trash-2" size={16} color="#C53030" />
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>

        {/* Fixed Floating Action Button (+) for New Member */}
        <Pressable
          onPress={handleOpenCreateMember}
          className="absolute bottom-5 right-5 h-16 w-16 items-center justify-center rounded-full bg-pine shadow-lg active:bg-pine-dark"
          accessibilityLabel={t(HOUSEHOLDS_CONSTANTS.NEW_MEMBER_TITLE)}
        >
          <Ionicons name="add" size={32} color="#FFFFFF" />
        </Pressable>

        {/* Create / Edit Member Modal */}
        <Modal
          visible={isMemberModalOpen}
          animationType="slide"
          transparent
          onRequestClose={() => setIsMemberModalOpen(false)}
        >
          <View className="flex-1 justify-end bg-black/40">
            <View className="max-h-[90%] rounded-t-3xl bg-[#F4FAF6] px-5 pt-5 pb-8">
              <View className="flex-row items-center justify-between pb-3 border-b border-[#DCECE3]">
                <View>
                  <Text className="text-[11px] font-extrabold uppercase tracking-wider text-sage">
                    budget.thousehold_member • {selectedHouseholdForMembers.name}
                  </Text>
                  <Text className="text-xl font-extrabold text-pine">
                    {editingMember
                      ? t(HOUSEHOLDS_CONSTANTS.EDIT_MEMBER_TITLE)
                      : t(HOUSEHOLDS_CONSTANTS.NEW_MEMBER_TITLE)}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setIsMemberModalOpen(false)}
                  className="h-9 w-9 items-center justify-center rounded-full bg-[#E2EFE8]"
                >
                  <Ionicons name="close" size={20} color="#0B3D2E" />
                </Pressable>
              </View>

              <ScrollView className="mt-4" contentContainerClassName="gap-3.5 pb-6">
                {/* 1. User FK Dropdown (budget.tuser) */}
                <View>
                  <Text className="mb-1 text-xs font-bold text-[#3B4F46]">
                    {t(HOUSEHOLDS_CONSTANTS.USER_FK_LABEL)} *
                  </Text>
                  <Pressable
                    onPress={() =>
                      setOpenMemberDropdown((prev) => (prev === 'user' ? null : 'user'))
                    }
                    className="flex-row items-center justify-between rounded-xl bg-white px-3.5 py-3 border border-[#DCECE3]"
                  >
                    <Text className="text-sm font-bold text-[#12211B]">
                      {selectedModalUser
                        ? `${selectedModalUser.full_name} (${selectedModalUser.email_user})`
                        : t(COMMON_CONSTANTS.NONE)}
                    </Text>
                    <Ionicons
                      name={openMemberDropdown === 'user' ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color="#0B3D2E"
                    />
                  </Pressable>

                  {openMemberDropdown === 'user' ? (
                    <View className="mt-1.5 max-h-48 rounded-xl bg-white p-1.5 border border-[#DCECE3]">
                      <ScrollView nestedScrollEnabled>
                        {users.map((u) => {
                          const selected = memberUserId === u.id;
                          return (
                            <Pressable
                              key={u.id}
                              onPress={() => {
                                setMemberUserId(u.id);
                                setOpenMemberDropdown(null);
                              }}
                              className={`flex-row items-center justify-between rounded-lg px-3 py-2 ${
                                selected ? 'bg-[#E6F4EC]' : 'bg-transparent'
                              }`}
                            >
                              <View>
                                <Text className="text-xs font-bold text-pine">{u.full_name}</Text>
                                <Text className="text-[10px] text-[#5A6D64]">{u.email_user}</Text>
                              </View>
                              {selected ? (
                                <Ionicons name="checkmark-circle" size={16} color="#0B3D2E" />
                              ) : null}
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                  ) : null}
                </View>

                {/* 2. Role Selector (admin / member) */}
                <View>
                  <Text className="mb-1.5 text-xs font-bold text-[#3B4F46]">
                    {t(COMMON_CONSTANTS.ROLE)} (role) *
                  </Text>
                  <View className="flex-row gap-2">
                    {MEMBER_ROLE_OPTIONS.map((opt) => {
                      const active = memberRole === opt;
                      return (
                        <Pressable
                          key={opt}
                          onPress={() => setMemberRole(opt)}
                          className={`flex-1 items-center rounded-xl py-2.5 border ${
                            active ? 'bg-pine border-pine' : 'bg-white border-[#DCECE3]'
                          }`}
                        >
                          <Text
                            className={`text-xs font-extrabold uppercase ${
                              active ? 'text-white' : 'text-pine'
                            }`}
                          >
                            {opt}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* 3. Member Type Selector (dad / mom / son / other) */}
                <View>
                  <Text className="mb-1.5 text-xs font-bold text-[#3B4F46]">
                    {t(HOUSEHOLDS_CONSTANTS.MEMBER_TYPE_LABEL)} *
                  </Text>
                  <View className="flex-row gap-2">
                    {MEMBER_TYPE_OPTIONS.map((opt) => {
                      const active = memberType === opt;
                      return (
                        <Pressable
                          key={opt}
                          onPress={() => setMemberType(opt)}
                          className={`flex-1 items-center rounded-xl py-2.5 border ${
                            active ? 'bg-pine border-pine' : 'bg-white border-[#DCECE3]'
                          }`}
                        >
                          <Text
                            className={`text-xs font-extrabold uppercase ${
                              active ? 'text-white' : 'text-pine'
                            }`}
                          >
                            {opt}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* 4. Auxiliar FK Dropdown (budget.tauxiliar) */}
                <View>
                  <Text className="mb-1 text-xs font-bold text-[#3B4F46]">
                    {t(HOUSEHOLDS_CONSTANTS.AUXILIAR_LABEL)}
                  </Text>
                  <Pressable
                    onPress={() =>
                      setOpenMemberDropdown((prev) =>
                        prev === 'auxiliar' ? null : 'auxiliar',
                      )
                    }
                    className="flex-row items-center justify-between rounded-xl bg-white px-3.5 py-3 border border-[#DCECE3]"
                  >
                    <Text className="text-sm font-bold text-[#12211B]">
                      {selectedModalMemberAux
                        ? `${selectedModalMemberAux.code} — ${selectedModalMemberAux.name}`
                        : t(COMMON_CONSTANTS.NONE)}
                    </Text>
                    <Ionicons
                      name={openMemberDropdown === 'auxiliar' ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color="#0B3D2E"
                    />
                  </Pressable>

                  {openMemberDropdown === 'auxiliar' ? (
                    <View className="mt-1.5 max-h-44 rounded-xl bg-white p-1.5 border border-[#DCECE3]">
                      <ScrollView nestedScrollEnabled>
                        <Pressable
                          onPress={() => {
                            setMemberAuxiliarId(null);
                            setOpenMemberDropdown(null);
                          }}
                          className={`flex-row items-center justify-between rounded-lg px-3 py-2 ${
                            memberAuxiliarId === null ? 'bg-[#E6F4EC]' : 'bg-transparent'
                          }`}
                        >
                          <Text className="text-xs font-bold text-pine">
                            {t(COMMON_CONSTANTS.NONE)}
                          </Text>
                          {memberAuxiliarId === null ? (
                            <Ionicons name="checkmark-circle" size={16} color="#0B3D2E" />
                          ) : null}
                        </Pressable>

                        {auxiliars.map((aux) => {
                          const selected = memberAuxiliarId === aux.id;
                          return (
                            <Pressable
                              key={aux.id}
                              onPress={() => {
                                setMemberAuxiliarId(aux.id);
                                setOpenMemberDropdown(null);
                              }}
                              className={`flex-row items-center justify-between rounded-lg px-3 py-2 ${
                                selected ? 'bg-[#E6F4EC]' : 'bg-transparent'
                              }`}
                            >
                              <Text className="text-xs font-bold text-[#12211B]">
                                {aux.code} — {aux.name}
                              </Text>
                              {selected ? (
                                <Ionicons name="checkmark-circle" size={16} color="#0B3D2E" />
                              ) : null}
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                  ) : null}
                </View>

                {/* 5. Preferences JSON */}
                <View>
                  <Text className="mb-1 text-xs font-bold text-[#3B4F46]">
                    {t(HOUSEHOLDS_CONSTANTS.PREFERENCES_LABEL)}
                  </Text>
                  <TextInput
                    value={memberPreferencesText}
                    onChangeText={setMemberPreferencesText}
                    autoCapitalize="none"
                    placeholder="{}"
                    placeholderTextColor="#8FA198"
                    className="rounded-xl bg-white px-3.5 py-2.5 text-sm text-[#12211B] border border-[#DCECE3]"
                  />
                </View>

                {memberFormError ? (
                  <View className="rounded-2xl bg-red-50 p-3 border border-red-200">
                    <Text className="text-xs font-bold text-red-700">{memberFormError}</Text>
                  </View>
                ) : null}

                <Pressable
                  onPress={() => void handleSaveMember()}
                  disabled={savingMember}
                  className="mt-2 flex-row items-center justify-center rounded-2xl bg-pine py-4 shadow-md active:opacity-90 disabled:opacity-50"
                >
                  {savingMember ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
                      <Text className="ml-2 text-sm font-extrabold text-white">
                        {editingMember
                          ? t(COMMON_CONSTANTS.SAVE_CHANGES)
                          : t(HOUSEHOLDS_CONSTANTS.CREATE_MEMBER_BTN)}
                      </Text>
                    </>
                  )}
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Confirm Logical Delete Member Modal */}
        <Modal
          visible={Boolean(memberToDelete)}
          animationType="fade"
          transparent
          onRequestClose={() => setMemberToDelete(null)}
        >
          <View className="flex-1 items-center justify-center bg-black/40 px-5">
            <View className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
              <View className="h-12 w-12 items-center justify-center rounded-full bg-[#FFF5F5] self-center">
                <Feather name="trash-2" size={22} color="#C53030" />
              </View>
              <Text className="mt-3 text-center text-lg font-extrabold text-[#12211B]">
                {t(HOUSEHOLDS_CONSTANTS.DELETE_MEMBER_TITLE)}
              </Text>
              <Text className="mt-1.5 text-center text-[13px] text-[#5A6D64]">
                {t(COMMON_CONSTANTS.LOGICAL_DELETE_DESC, {
                  name: (memberToDelete && userMap.get(memberToDelete.user_id)?.full_name) || '',
                })}
              </Text>

              {deleteMemberError ? (
                <View className="mt-3 rounded-xl bg-red-50 p-3">
                  <Text className="text-xs font-bold text-red-700">{deleteMemberError}</Text>
                </View>
              ) : null}

              <View className="mt-5 flex-row gap-2.5">
                <Pressable
                  onPress={() => setMemberToDelete(null)}
                  disabled={deletingMember}
                  className="flex-1 items-center justify-center rounded-2xl bg-[#E8F4ED] py-3"
                >
                  <Text className="text-xs font-extrabold text-pine">
                    {t(COMMON_CONSTANTS.CANCEL)}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => void handleConfirmDeleteMember()}
                  disabled={deletingMember}
                  className="flex-1 items-center justify-center rounded-2xl bg-[#C53030] py-3"
                >
                  {deletingMember ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text className="text-xs font-extrabold text-white">
                      {t(COMMON_CONSTANTS.DELETE)}
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ============================================================================
  // MAIN HOUSEHOLDS INTERFACE (budget.thousehold)
  // ============================================================================
  return (
    <View className="relative flex-1 bg-[#F2F8F4]">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pt-3 pb-28 max-w-5xl w-full self-center"
      >
        {/* Top Header Pill */}
        <View className="mb-3 flex-row items-center justify-between">
          <View className="flex-row items-center rounded-full bg-[#DCECE3] px-4 py-2">
            <Ionicons name="home-outline" size={16} color="#0B3D2E" />
            <Text className="ml-2 text-[13px] font-bold text-pine">
              {t(HOUSEHOLDS_CONSTANTS.TITLE, { count: households.length })}
            </Text>
          </View>

          <View className="rounded-full bg-[#E6F4EC] px-3 py-1">
            <Text className="text-[11px] font-extrabold text-pine">budget.thousehold</Text>
          </View>
        </View>

        {/* Search Input + Refresh Button */}
        <View className="flex-row items-center gap-2.5 mb-4">
          <View className="flex-1 flex-row items-center rounded-2xl bg-white px-4 py-3 shadow-sm border border-[#E5F0EA]">
            <Ionicons name="search-outline" size={20} color="#7A8C83" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t(HOUSEHOLDS_CONSTANTS.SEARCH_PLACEHOLDER)}
              placeholderTextColor="#7A8C83"
              className="ml-2.5 flex-1 text-[15px] text-pine"
            />
            {searchQuery ? (
              <Pressable onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="#9BA8A2" />
              </Pressable>
            ) : null}
          </View>

          <Pressable
            onPress={() => void loadHouseholdsData()}
            className="h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm border border-[#E5F0EA] active:bg-[#E8F4ED]"
            accessibilityLabel={t(COMMON_CONSTANTS.REFRESH)}
          >
            <Ionicons name="refresh" size={20} color="#0B3D2E" />
          </Pressable>
        </View>

        {/* Households List in Journal Card Style */}
        {loadingHouseholds ? (
          <View className="py-10 items-center">
            <ActivityIndicator size="large" color="#0B3D2E" />
          </View>
        ) : filteredHouseholds.length === 0 ? (
          <View className="mt-3 items-center rounded-3xl bg-white p-8 shadow-sm border border-[#E5F0EA]">
            <Ionicons name="home-outline" size={36} color="#9BA8A2" />
            <Text className="mt-3 text-[15px] font-bold text-[#12211B]">
              {t(HOUSEHOLDS_CONSTANTS.EMPTY_TITLE)}
            </Text>
            <Text className="mt-1 text-center text-[13px] text-[#5A6D64]">
              {t(HOUSEHOLDS_CONSTANTS.EMPTY_DESC)}
            </Text>
          </View>
        ) : (
          <View className="gap-2.5">
            {filteredHouseholds.map((hh) => {
              const bizType = businessTypeMap.get(hh.business_type_id);
              const aux = hh.auxiliar_id ? auxiliarMap.get(hh.auxiliar_id) : undefined;
              const count = memberCounts[hh.id] ?? 0;

              return (
                <View
                  key={hh.id}
                  className="flex-row items-center justify-between rounded-3xl bg-white px-4 py-3.5 shadow-sm border border-[#E7F1EC]"
                >
                  {/* Left Circular Icon + Household Details */}
                  <View className="flex-row items-center flex-1 mr-2">
                    <View
                      className="h-12 w-12 items-center justify-center rounded-full"
                      style={{ backgroundColor: '#E6F4EC' }}
                    >
                      <Ionicons name="home-outline" size={22} color="#0B3D2E" />
                    </View>

                    <View className="ml-3 flex-1">
                      <View className="flex-row items-center flex-wrap gap-1.5">
                        <Text
                          className="text-[15px] font-extrabold text-[#12211B]"
                          numberOfLines={1}
                        >
                          {hh.name}
                        </Text>
                        <View className="rounded-full bg-[#DFF5E8] px-2.5 py-0.5">
                          <Text className="text-[10px] font-extrabold text-[#0B3D2E]">
                            {hh.currency ?? 'BOB'}
                          </Text>
                        </View>
                        {bizType ? (
                          <View className="rounded-full bg-[#E3ECE7] px-2.5 py-0.5">
                            <Text className="text-[10px] font-bold text-[#3B4F46]">
                              {bizType.name}
                            </Text>
                          </View>
                        ) : null}
                        <View className="rounded-full bg-[#FFF1E6] px-2 py-0.5">
                          <Text className="text-[10px] font-extrabold text-[#9A4B1A]">
                            {count}{' '}
                            {count === 1
                              ? t(HOUSEHOLDS_CONSTANTS.MEMBER_SINGULAR)
                              : t(HOUSEHOLDS_CONSTANTS.MEMBER_PLURAL)}
                          </Text>
                        </View>
                      </View>

                      <View className="mt-1 flex-row items-center">
                        <View className="h-4 w-4 items-center justify-center rounded-full bg-[#D9EBE0]">
                          <Text className="text-[8px] font-extrabold text-pine">
                            {(hh.name[0] ?? 'H').toUpperCase()}
                          </Text>
                        </View>
                        <Text
                          className="ml-1.5 text-[12px] font-medium text-[#5A6D64] flex-1"
                          numberOfLines={1}
                        >
                          {aux
                            ? `Aux: ${aux.code} — ${aux.name}`
                            : `${t(COMMON_CONSTANTS.CURRENCY)}: ${hh.currency ?? 'BOB'} • ${hh.status ?? 'active'}`}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Right Flat Action Icons: Members (thousehold_member), Edit, Delete */}
                  <View className="flex-row items-center gap-1.5">
                    <Pressable
                      onPress={() => setSelectedHouseholdForMembers(hh)}
                      className="h-9 w-9 items-center justify-center rounded-full bg-[#E6F4EC] active:bg-[#CDE6D8]"
                      accessibilityLabel={t(HOUSEHOLDS_CONSTANTS.MEMBERS_HEADER)}
                    >
                      <Ionicons name="people-outline" size={18} color="#0B3D2E" />
                    </Pressable>

                    <Pressable
                      onPress={() => handleOpenEditHousehold(hh)}
                      className="h-9 w-9 items-center justify-center rounded-full bg-[#F2F8F4] active:bg-[#DCECE3]"
                      accessibilityLabel={t(COMMON_CONSTANTS.EDIT)}
                    >
                      <Feather name="edit-2" size={16} color="#0B3D2E" />
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        setDeleteHouseholdError(null);
                        setHouseholdToDelete(hh);
                      }}
                      className="h-9 w-9 items-center justify-center rounded-full bg-[#FFF5F5] active:bg-[#FED7D7]"
                      accessibilityLabel={t(COMMON_CONSTANTS.DELETE)}
                    >
                      <Feather name="trash-2" size={16} color="#C53030" />
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Fixed Floating Action Button (+) at bottom-right */}
      <Pressable
        onPress={handleOpenCreateHousehold}
        className="absolute bottom-5 right-5 h-16 w-16 items-center justify-center rounded-full bg-pine shadow-lg active:bg-pine-dark"
        accessibilityLabel={t(HOUSEHOLDS_CONSTANTS.NEW_TITLE)}
      >
        <Ionicons name="add" size={32} color="#FFFFFF" />
      </Pressable>

      {/* Create / Edit Household Modal */}
      <Modal
        visible={isHouseholdModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsHouseholdModalOpen(false)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="max-h-[90%] rounded-t-3xl bg-[#F4FAF6] px-5 pt-5 pb-8">
            <View className="flex-row items-center justify-between pb-3 border-b border-[#DCECE3]">
              <View>
                <Text className="text-[11px] font-extrabold uppercase tracking-wider text-sage">
                  budget.thousehold
                </Text>
                <Text className="text-xl font-extrabold text-pine">
                  {editingHousehold
                    ? t(HOUSEHOLDS_CONSTANTS.EDIT_TITLE)
                    : t(HOUSEHOLDS_CONSTANTS.NEW_TITLE)}
                </Text>
              </View>
              <Pressable
                onPress={() => setIsHouseholdModalOpen(false)}
                className="h-9 w-9 items-center justify-center rounded-full bg-[#E2EFE8]"
              >
                <Ionicons name="close" size={20} color="#0B3D2E" />
              </Pressable>
            </View>

            <ScrollView className="mt-4" contentContainerClassName="gap-3.5 pb-6">
              {/* 1. Business Type FK Dropdown (budget.tbusiness_type) */}
              <View>
                <Text className="mb-1 text-xs font-bold text-[#3B4F46]">
                  {t(HOUSEHOLDS_CONSTANTS.BUSINESS_TYPE_LABEL)} *
                </Text>
                <Pressable
                  onPress={() =>
                    setOpenHhDropdown((prev) =>
                      prev === 'business_type' ? null : 'business_type',
                    )
                  }
                  className="flex-row items-center justify-between rounded-xl bg-white px-3.5 py-3 border border-[#DCECE3]"
                >
                  <Text className="text-sm font-bold text-[#12211B]">
                    {selectedModalBusinessType
                      ? `${selectedModalBusinessType.name} (${selectedModalBusinessType.code})`
                      : t(COMMON_CONSTANTS.NONE)}
                  </Text>
                  <Ionicons
                    name={openHhDropdown === 'business_type' ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color="#0B3D2E"
                  />
                </Pressable>

                {openHhDropdown === 'business_type' ? (
                  <View className="mt-1.5 rounded-xl bg-white p-1.5 border border-[#DCECE3]">
                    {businessTypes.map((bt) => {
                      const selected = businessTypeId === bt.id;
                      return (
                        <Pressable
                          key={bt.id}
                          onPress={() => {
                            setBusinessTypeId(bt.id);
                            setOpenHhDropdown(null);
                          }}
                          className={`flex-row items-center justify-between rounded-lg px-3 py-2 ${
                            selected ? 'bg-[#E6F4EC]' : 'bg-transparent'
                          }`}
                        >
                          <Text className="text-xs font-bold text-pine">
                            {bt.name} ({bt.code})
                          </Text>
                          {selected ? (
                            <Ionicons name="checkmark-circle" size={16} color="#0B3D2E" />
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </View>

              {/* 2. Name */}
              <View>
                <Text className="mb-1 text-xs font-bold text-[#3B4F46]">
                  {t(COMMON_CONSTANTS.NAME)} (name) *
                </Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Morales Family"
                  placeholderTextColor="#8FA198"
                  className="rounded-xl bg-white px-3.5 py-2.5 text-sm text-[#12211B] border border-[#DCECE3]"
                />
              </View>

              {/* 3. Currency */}
              <View>
                <Text className="mb-1.5 text-xs font-bold text-[#3B4F46]">
                  {t(COMMON_CONSTANTS.CURRENCY)} (currency)
                </Text>
                <View className="flex-row gap-2">
                  {CURRENCY_OPTIONS.map((curr) => {
                    const active = currency === curr;
                    return (
                      <Pressable
                        key={curr}
                        onPress={() => setCurrency(curr)}
                        className={`flex-1 items-center rounded-xl py-2.5 border ${
                          active ? 'bg-pine border-pine' : 'bg-white border-[#DCECE3]'
                        }`}
                      >
                        <Text
                          className={`text-xs font-extrabold ${
                            active ? 'text-white' : 'text-pine'
                          }`}
                        >
                          {curr}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* 4. Auxiliar FK Dropdown (budget.tauxiliar) */}
              <View>
                <Text className="mb-1 text-xs font-bold text-[#3B4F46]">
                  {t(HOUSEHOLDS_CONSTANTS.AUXILIAR_LABEL)}
                </Text>
                <Pressable
                  onPress={() =>
                    setOpenHhDropdown((prev) => (prev === 'auxiliar' ? null : 'auxiliar'))
                  }
                  className="flex-row items-center justify-between rounded-xl bg-white px-3.5 py-3 border border-[#DCECE3]"
                >
                  <Text className="text-sm font-bold text-[#12211B]">
                    {selectedModalAuxiliar
                      ? `${selectedModalAuxiliar.code} — ${selectedModalAuxiliar.name}`
                      : t(COMMON_CONSTANTS.NONE)}
                  </Text>
                  <Ionicons
                    name={openHhDropdown === 'auxiliar' ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color="#0B3D2E"
                  />
                </Pressable>

                {openHhDropdown === 'auxiliar' ? (
                  <View className="mt-1.5 max-h-44 rounded-xl bg-white p-1.5 border border-[#DCECE3]">
                    <ScrollView nestedScrollEnabled>
                      <Pressable
                        onPress={() => {
                          setAuxiliarId(null);
                          setOpenHhDropdown(null);
                        }}
                        className={`flex-row items-center justify-between rounded-lg px-3 py-2 ${
                          auxiliarId === null ? 'bg-[#E6F4EC]' : 'bg-transparent'
                        }`}
                      >
                        <Text className="text-xs font-bold text-pine">
                          {t(COMMON_CONSTANTS.NONE)}
                        </Text>
                        {auxiliarId === null ? (
                          <Ionicons name="checkmark-circle" size={16} color="#0B3D2E" />
                        ) : null}
                      </Pressable>

                      {auxiliars.map((aux) => {
                        const selected = auxiliarId === aux.id;
                        return (
                          <Pressable
                            key={aux.id}
                            onPress={() => {
                              setAuxiliarId(aux.id);
                              setOpenHhDropdown(null);
                            }}
                            className={`flex-row items-center justify-between rounded-lg px-3 py-2 ${
                              selected ? 'bg-[#E6F4EC]' : 'bg-transparent'
                            }`}
                          >
                            <Text className="text-xs font-bold text-[#12211B]">
                              {aux.code} — {aux.name}
                            </Text>
                            {selected ? (
                              <Ionicons name="checkmark-circle" size={16} color="#0B3D2E" />
                            ) : null}
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                ) : null}
              </View>

              {/* 5. Preferences JSON */}
              <View>
                <Text className="mb-1 text-xs font-bold text-[#3B4F46]">
                  {t(HOUSEHOLDS_CONSTANTS.PREFERENCES_LABEL)}
                </Text>
                <TextInput
                  value={preferencesText}
                  onChangeText={setPreferencesText}
                  autoCapitalize="none"
                  placeholder="{}"
                  placeholderTextColor="#8FA198"
                  className="rounded-xl bg-white px-3.5 py-2.5 text-sm text-[#12211B] border border-[#DCECE3]"
                />
              </View>

              {householdFormError ? (
                <View className="rounded-2xl bg-red-50 p-3 border border-red-200">
                  <Text className="text-xs font-bold text-red-700">{householdFormError}</Text>
                </View>
              ) : null}

              <Pressable
                onPress={() => void handleSaveHousehold()}
                disabled={savingHousehold}
                className="mt-2 flex-row items-center justify-center rounded-2xl bg-pine py-4 shadow-md active:opacity-90 disabled:opacity-50"
              >
                {savingHousehold ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
                    <Text className="ml-2 text-sm font-extrabold text-white">
                      {editingHousehold
                        ? t(COMMON_CONSTANTS.SAVE_CHANGES)
                        : t(HOUSEHOLDS_CONSTANTS.CREATE_BTN)}
                    </Text>
                  </>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Confirm Logical Delete Household Modal */}
      <Modal
        visible={Boolean(householdToDelete)}
        animationType="fade"
        transparent
        onRequestClose={() => setHouseholdToDelete(null)}
      >
        <View className="flex-1 items-center justify-center bg-black/40 px-5">
          <View className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-[#FFF5F5] self-center">
              <Feather name="trash-2" size={22} color="#C53030" />
            </View>
            <Text className="mt-3 text-center text-lg font-extrabold text-[#12211B]">
              {t(HOUSEHOLDS_CONSTANTS.DELETE_TITLE)}
            </Text>
            <Text className="mt-1.5 text-center text-[13px] text-[#5A6D64]">
              {t(COMMON_CONSTANTS.LOGICAL_DELETE_DESC, {
                name: householdToDelete?.name || '',
              })}
            </Text>

            {deleteHouseholdError ? (
              <View className="mt-3 rounded-xl bg-red-50 p-3">
                <Text className="text-xs font-bold text-red-700">{deleteHouseholdError}</Text>
              </View>
            ) : null}

            <View className="mt-5 flex-row gap-2.5">
              <Pressable
                onPress={() => setHouseholdToDelete(null)}
                disabled={deletingHousehold}
                className="flex-1 items-center justify-center rounded-2xl bg-[#E8F4ED] py-3"
              >
                <Text className="text-xs font-extrabold text-pine">
                  {t(COMMON_CONSTANTS.CANCEL)}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => void handleConfirmDeleteHousehold()}
                disabled={deletingHousehold}
                className="flex-1 items-center justify-center rounded-2xl bg-[#C53030] py-3"
              >
                {deletingHousehold ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-xs font-extrabold text-white">
                    {t(COMMON_CONSTANTS.DELETE)}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

