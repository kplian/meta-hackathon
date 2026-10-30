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
import type { AuxiliarRow, AuxiliarTypeRow, HouseholdRow } from '../lib/budget-schema';
import { AUXILIARS_CONSTANTS, COMMON_CONSTANTS } from '../i18n/constants';

interface AuxiliarsViewProps {
  currentUserId: string;
  activeHousehold?: HouseholdRow | null;
}

export default function AuxiliarsView({ currentUserId, activeHousehold }: AuxiliarsViewProps) {
  const { t } = useTranslation();
  const [auxiliars, setAuxiliars] = useState<AuxiliarRow[]>([]);
  const [households, setHouseholds] = useState<HouseholdRow[]>([]);
  const [auxiliarTypes, setAuxiliarTypes] = useState<AuxiliarTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Top filter dropdown by household_id
  const [selectedHouseholdFilter, setSelectedHouseholdFilter] = useState<string>(
    activeHousehold?.id ?? 'ALL',
  );
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);

  // Create / Edit modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAuxiliar, setEditingAuxiliar] = useState<AuxiliarRow | null>(null);
  const [householdId, setHouseholdId] = useState<string>('');
  const [auxiliarTypeId, setAuxiliarTypeId] = useState<string>('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [openModalDropdown, setOpenModalDropdown] = useState<
    'household' | 'auxiliar_type' | 'parent' | null
  >(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Logical Delete confirmation modal state
  const [auxiliarToDelete, setAuxiliarToDelete] = useState<AuxiliarRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  // Load active non-deleted auxiliars, households, and auxiliar types
  const loadAuxiliarsData = async () => {
    setLoading(true);
    try {
      const [auxRes, hhRes, atRes] = await Promise.all([
        supabase
          .schema('budget')
          .from('tauxiliar')
          .select('*')
          .is('deleted_at', null)
          .order('code', { ascending: true }),
        supabase
          .schema('budget')
          .from('thousehold')
          .select('*')
          .is('deleted_at', null)
          .order('name', { ascending: true }),
        supabase
          .schema('budget')
          .from('tauxiliar_type')
          .select('*')
          .is('deleted_at', null)
          .order('name', { ascending: true }),
      ]);

      setAuxiliars(auxRes.data ?? []);
      setHouseholds(hhRes.data ?? []);
      setAuxiliarTypes(atRes.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAuxiliarsData();
  }, []);

  const householdMap = useMemo(
    () => new Map(households.map((h) => [h.id, h])),
    [households],
  );
  const auxiliarTypeMap = useMemo(
    () => new Map(auxiliarTypes.map((at) => [at.id, at])),
    [auxiliarTypes],
  );
  const auxiliarMap = useMemo(
    () => new Map(auxiliars.map((a) => [a.id, a])),
    [auxiliars],
  );

  // Filter auxiliars by selected household_id and search query
  const filteredAuxiliars = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return auxiliars.filter((item) => {
      if (
        selectedHouseholdFilter !== 'ALL' &&
        item.household_id !== selectedHouseholdFilter
      ) {
        return false;
      }
      if (!q) return true;
      const hhName = householdMap.get(item.household_id)?.name || '';
      const atName = auxiliarTypeMap.get(item.auxiliar_type_id)?.name || '';
      return (
        item.code.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        (item.description ?? '').toLowerCase().includes(q) ||
        hhName.toLowerCase().includes(q) ||
        atName.toLowerCase().includes(q)
      );
    });
  }, [auxiliars, selectedHouseholdFilter, searchQuery, householdMap, auxiliarTypeMap]);

  // Open Create modal
  const handleOpenCreate = () => {
    setEditingAuxiliar(null);
    setHouseholdId(
      selectedHouseholdFilter !== 'ALL'
        ? selectedHouseholdFilter
        : activeHousehold?.id ?? households[0]?.id ?? '',
    );
    setAuxiliarTypeId(auxiliarTypes[0]?.id ?? '');
    setParentId(null);
    setCode('');
    setName('');
    setDescription('');
    setOpenModalDropdown(null);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open Edit modal pre-populated with selected record
  const handleOpenEdit = (item: AuxiliarRow) => {
    setEditingAuxiliar(item);
    setHouseholdId(item.household_id);
    setAuxiliarTypeId(item.auxiliar_type_id);
    setParentId(item.parent_id ?? null);
    setCode(item.code);
    setName(item.name);
    setDescription(item.description ?? '');
    setOpenModalDropdown(null);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Save Auxiliar (Create or Update)
  const handleSave = async () => {
    setFormError(null);
    if (!householdId) {
      setFormError('Selecciona un Household (household_id) del desplegable.');
      return;
    }
    if (!auxiliarTypeId) {
      setFormError('Selecciona un Auxiliar Type (auxiliar_type_id) del desplegable.');
      return;
    }
    if (!code.trim()) {
      setFormError('El código (code) es obligatorio (ej. AUX-COMP, AUX-PERS).');
      return;
    }
    if (!name.trim()) {
      setFormError('El nombre (name) es obligatorio.');
      return;
    }

    setSaving(true);
    try {
      const actorId = await resolveActorUserId();

      if (editingAuxiliar) {
        const { error } = await supabase
          .schema('budget')
          .from('tauxiliar')
          .update({
            household_id: householdId,
            auxiliar_type_id: auxiliarTypeId,
            parent_id: parentId || null,
            code: code.trim().toUpperCase(),
            name: name.trim(),
            description: description.trim() || null,
            updated_at: new Date().toISOString(),
            updated_by: actorId,
          })
          .eq('id', editingAuxiliar.id);

        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .schema('budget')
          .from('tauxiliar')
          .insert({
            household_id: householdId,
            auxiliar_type_id: auxiliarTypeId,
            parent_id: parentId || null,
            code: code.trim().toUpperCase(),
            name: name.trim(),
            description: description.trim() || null,
            status: 'active',
            created_by: actorId,
          });

        if (error) throw new Error(error.message);
      }

      setIsModalOpen(false);
      await loadAuxiliarsData();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Error al guardar el auxiliar',
      );
    } finally {
      setSaving(false);
    }
  };

  // Confirm logical deletion (updates deleted_at and deleted_by)
  const handleConfirmDelete = async () => {
    if (!auxiliarToDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const actorId = await resolveActorUserId();
      const { error } = await supabase
        .schema('budget')
        .from('tauxiliar')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: actorId,
          status: 'inactive',
        })
        .eq('id', auxiliarToDelete.id);

      if (error) throw new Error(error.message);

      setAuxiliarToDelete(null);
      await loadAuxiliarsData();
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : 'No se pudo eliminar el auxiliar',
      );
    } finally {
      setDeleting(false);
    }
  };

  // Candidate parent auxiliars in the selected household (excluding self)
  const availableParentAuxiliars = useMemo(() => {
    return auxiliars.filter((aux) => {
      if (editingAuxiliar && aux.id === editingAuxiliar.id) return false;
      if (householdId && aux.household_id !== householdId) return false;
      return true;
    });
  }, [auxiliars, editingAuxiliar, householdId]);

  const selectedFilterHhLabel =
    selectedHouseholdFilter === 'ALL'
      ? t(AUXILIARS_CONSTANTS.ALL_HOUSEHOLDS)
      : householdMap.get(selectedHouseholdFilter)?.name ?? 'Household';

  const selectedModalHousehold = householdMap.get(householdId);
  const selectedModalAuxType = auxiliarTypeMap.get(auxiliarTypeId);
  const selectedModalParent = parentId ? auxiliarMap.get(parentId) : null;

  return (
    <View className="relative flex-1 bg-[#F2F8F4]">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pt-3 pb-28 max-w-5xl w-full self-center"
      >
        {/* Top Bar: Household Filter Dropdown + Table Badge */}
        <View className="mb-3 flex-row items-center justify-between flex-wrap gap-2">
          <Pressable
            onPress={() => setIsFilterDropdownOpen((prev) => !prev)}
            className="flex-row items-center rounded-full bg-[#DCECE3] px-4 py-2 active:bg-[#CBE2D5]"
          >
            <Ionicons name="home-outline" size={16} color="#0B3D2E" />
            <Text className="ml-2 mr-1.5 text-[13px] font-bold text-pine">
              {selectedFilterHhLabel}
            </Text>
            <Ionicons
              name={isFilterDropdownOpen ? 'chevron-up' : 'chevron-down'}
              size={15}
              color="#0B3D2E"
            />
          </Pressable>

          <View className="rounded-full bg-[#E6F4EC] px-3 py-1">
            <Text className="text-[11px] font-extrabold text-pine">
              budget.tauxiliar • {filteredAuxiliars.length}{' '}
              {t(COMMON_CONSTANTS.RECORDS).toLowerCase()}
            </Text>
          </View>
        </View>

        {/* Household Filter Dropdown Menu */}
        {isFilterDropdownOpen ? (
          <View className="mb-3 rounded-2xl bg-white p-2 shadow-md border border-[#DCECE3]">
            <Pressable
              onPress={() => {
                setSelectedHouseholdFilter('ALL');
                setIsFilterDropdownOpen(false);
              }}
              className={`flex-row items-center justify-between rounded-xl px-3.5 py-2.5 ${
                selectedHouseholdFilter === 'ALL' ? 'bg-[#E6F4EC]' : 'bg-transparent'
              }`}
            >
              <Text className="text-xs font-extrabold text-pine">
                {t(AUXILIARS_CONSTANTS.ALL_HOUSEHOLDS)}
              </Text>
              {selectedHouseholdFilter === 'ALL' ? (
                <Ionicons name="checkmark-circle" size={16} color="#0B3D2E" />
              ) : null}
            </Pressable>

            {households.map((hh) => {
              const isSelected = selectedHouseholdFilter === hh.id;
              return (
                <Pressable
                  key={hh.id}
                  onPress={() => {
                    setSelectedHouseholdFilter(hh.id);
                    setIsFilterDropdownOpen(false);
                  }}
                  className={`flex-row items-center justify-between rounded-xl px-3.5 py-2.5 ${
                    isSelected ? 'bg-[#E6F4EC]' : 'bg-transparent'
                  }`}
                >
                  <View>
                    <Text className="text-xs font-extrabold text-pine">{hh.name}</Text>
                    <Text className="text-[10px] text-[#5A6D64]">
                      {t(COMMON_CONSTANTS.CURRENCY)}: {hh.currency ?? 'BOB'}
                    </Text>
                  </View>
                  {isSelected ? (
                    <Ionicons name="checkmark-circle" size={16} color="#0B3D2E" />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {/* Search Input + Refresh Button */}
        <View className="flex-row items-center gap-2.5 mb-4">
          <View className="flex-1 flex-row items-center rounded-2xl bg-white px-4 py-3 shadow-sm border border-[#E5F0EA]">
            <Ionicons name="search-outline" size={20} color="#7A8C83" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t(AUXILIARS_CONSTANTS.SEARCH_PLACEHOLDER)}
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
            onPress={() => void loadAuxiliarsData()}
            className="h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm border border-[#E5F0EA] active:bg-[#E8F4ED]"
            accessibilityLabel={t(COMMON_CONSTANTS.REFRESH)}
          >
            <Ionicons name="refresh" size={20} color="#0B3D2E" />
          </Pressable>
        </View>

        {/* Auxiliars List in Journal Card Style */}
        {loading ? (
          <View className="py-10 items-center">
            <ActivityIndicator size="large" color="#0B3D2E" />
          </View>
        ) : filteredAuxiliars.length === 0 ? (
          <View className="mt-3 items-center rounded-3xl bg-white p-8 shadow-sm border border-[#E5F0EA]">
            <Ionicons name="swap-horizontal-outline" size={36} color="#9BA8A2" />
            <Text className="mt-3 text-[15px] font-bold text-[#12211B]">
              {t(AUXILIARS_CONSTANTS.EMPTY_TITLE)}
            </Text>
            <Text className="mt-1 text-center text-[13px] text-[#5A6D64]">
              {t(AUXILIARS_CONSTANTS.EMPTY_DESC)}
            </Text>
          </View>
        ) : (
          <View className="gap-2.5">
            {filteredAuxiliars.map((item) => {
              const hh = householdMap.get(item.household_id);
              const at = auxiliarTypeMap.get(item.auxiliar_type_id);
              const parentAux = item.parent_id ? auxiliarMap.get(item.parent_id) : undefined;

              return (
                <View
                  key={item.id}
                  className="flex-row items-center justify-between rounded-3xl bg-white px-4 py-3.5 shadow-sm border border-[#E7F1EC]"
                >
                  {/* Left Circular Icon + Auxiliar Info */}
                  <View className="flex-row items-center flex-1 mr-2">
                    <View
                      className="h-12 w-12 items-center justify-center rounded-full"
                      style={{ backgroundColor: '#E6F4EC' }}
                    >
                      <Ionicons name="swap-horizontal-outline" size={22} color="#0B3D2E" />
                    </View>

                    <View className="ml-3 flex-1">
                      <View className="flex-row items-center flex-wrap gap-1.5">
                        <Text
                          className="text-[15px] font-extrabold text-[#12211B]"
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>

                        <View className="rounded-full bg-[#DFF5E8] px-2.5 py-0.5">
                          <Text className="text-[10px] font-extrabold text-[#0B3D2E]">
                            {item.code}
                          </Text>
                        </View>

                        {at ? (
                          <View className="rounded-full bg-[#FFF1E6] px-2.5 py-0.5">
                            <Text className="text-[10px] font-extrabold text-[#9A4B1A]">
                              {at.name}
                            </Text>
                          </View>
                        ) : null}

                        {hh ? (
                          <View className="rounded-full bg-[#E3ECE7] px-2.5 py-0.5">
                            <Text className="text-[10px] font-bold text-[#3B4F46]">
                              {hh.name}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      <View className="mt-1 flex-row items-center">
                        <View className="h-4 w-4 items-center justify-center rounded-full bg-[#D9EBE0]">
                          <Text className="text-[8px] font-extrabold text-pine">
                            {(item.name[0] ?? 'A').toUpperCase()}
                          </Text>
                        </View>
                        <Text
                          className="ml-1.5 text-[12px] font-medium text-[#5A6D64] flex-1"
                          numberOfLines={1}
                        >
                          {item.description || `${t(COMMON_CONSTANTS.CODE)}: ${item.code}`}
                          {parentAux ? ` • ${parentAux.code}` : ''}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Right Flat Action Icons: Edit & Delete */}
                  <View className="flex-row items-center gap-1.5">
                    <Pressable
                      onPress={() => handleOpenEdit(item)}
                      className="h-9 w-9 items-center justify-center rounded-full bg-[#F2F8F4] active:bg-[#DCECE3]"
                      accessibilityLabel={t(COMMON_CONSTANTS.EDIT)}
                    >
                      <Feather name="edit-2" size={16} color="#0B3D2E" />
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        setDeleteError(null);
                        setAuxiliarToDelete(item);
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
        onPress={handleOpenCreate}
        className="absolute bottom-5 right-5 h-16 w-16 items-center justify-center rounded-full bg-pine shadow-lg active:bg-pine-dark"
        accessibilityLabel={t(AUXILIARS_CONSTANTS.NEW_TITLE)}
      >
        <Ionicons name="add" size={32} color="#FFFFFF" />
      </Pressable>

      {/* Create / Edit Auxiliar Modal */}
      <Modal
        visible={isModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsModalOpen(false)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="max-h-[90%] rounded-t-3xl bg-[#F4FAF6] px-5 pt-5 pb-8">
            <View className="flex-row items-center justify-between pb-3 border-b border-[#DCECE3]">
              <View>
                <Text className="text-[11px] font-extrabold uppercase tracking-wider text-sage">
                  budget.tauxiliar
                </Text>
                <Text className="text-xl font-extrabold text-pine">
                  {editingAuxiliar
                    ? t(AUXILIARS_CONSTANTS.EDIT_TITLE)
                    : t(AUXILIARS_CONSTANTS.NEW_TITLE)}
                </Text>
              </View>
              <Pressable
                onPress={() => setIsModalOpen(false)}
                className="h-9 w-9 items-center justify-center rounded-full bg-[#E2EFE8]"
              >
                <Ionicons name="close" size={20} color="#0B3D2E" />
              </Pressable>
            </View>

            <ScrollView className="mt-4" contentContainerClassName="gap-3.5 pb-6">
              {/* 1. Household FK Dropdown (budget.thousehold) */}
              <View>
                <Text className="mb-1 text-xs font-bold text-[#3B4F46]">
                  {t(AUXILIARS_CONSTANTS.HOUSEHOLD_FK_LABEL)}
                </Text>
                <Pressable
                  onPress={() =>
                    setOpenModalDropdown((prev) =>
                      prev === 'household' ? null : 'household',
                    )
                  }
                  className="flex-row items-center justify-between rounded-xl bg-white px-3.5 py-3 border border-[#DCECE3]"
                >
                  <Text className="text-sm font-bold text-[#12211B]">
                    {selectedModalHousehold
                      ? `${selectedModalHousehold.name} (${selectedModalHousehold.currency ?? 'BOB'})`
                      : t(AUXILIARS_CONSTANTS.HOUSEHOLD_FK_LABEL)}
                  </Text>
                  <Ionicons
                    name={openModalDropdown === 'household' ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color="#0B3D2E"
                  />
                </Pressable>

                {openModalDropdown === 'household' ? (
                  <View className="mt-1.5 max-h-48 rounded-xl bg-white p-1.5 border border-[#DCECE3]">
                    <ScrollView nestedScrollEnabled>
                      {households.map((hh) => {
                        const selected = householdId === hh.id;
                        return (
                          <Pressable
                            key={hh.id}
                            onPress={() => {
                              setHouseholdId(hh.id);
                              setParentId(null);
                              setOpenModalDropdown(null);
                            }}
                            className={`flex-row items-center justify-between rounded-lg px-3 py-2 ${
                              selected ? 'bg-[#E6F4EC]' : 'bg-transparent'
                            }`}
                          >
                            <Text className="text-xs font-bold text-pine">
                              {hh.name} ({hh.currency ?? 'BOB'})
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

              {/* 2. Auxiliar Type FK Dropdown (budget.tauxiliar_type) */}
              <View>
                <Text className="mb-1 text-xs font-bold text-[#3B4F46]">
                  {t(AUXILIARS_CONSTANTS.AUXILIAR_TYPE_FK_LABEL)}
                </Text>
                <Pressable
                  onPress={() =>
                    setOpenModalDropdown((prev) =>
                      prev === 'auxiliar_type' ? null : 'auxiliar_type',
                    )
                  }
                  className="flex-row items-center justify-between rounded-xl bg-white px-3.5 py-3 border border-[#DCECE3]"
                >
                  <Text className="text-sm font-bold text-[#12211B]">
                    {selectedModalAuxType
                      ? `${selectedModalAuxType.name} (${selectedModalAuxType.code})`
                      : t(AUXILIARS_CONSTANTS.AUXILIAR_TYPE_FK_LABEL)}
                  </Text>
                  <Ionicons
                    name={openModalDropdown === 'auxiliar_type' ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color="#0B3D2E"
                  />
                </Pressable>

                {openModalDropdown === 'auxiliar_type' ? (
                  <View className="mt-1.5 max-h-48 rounded-xl bg-white p-1.5 border border-[#DCECE3]">
                    <ScrollView nestedScrollEnabled>
                      {auxiliarTypes.map((at) => {
                        const selected = auxiliarTypeId === at.id;
                        return (
                          <Pressable
                            key={at.id}
                            onPress={() => {
                              setAuxiliarTypeId(at.id);
                              setOpenModalDropdown(null);
                            }}
                            className={`flex-row items-center justify-between rounded-lg px-3 py-2 ${
                              selected ? 'bg-[#E6F4EC]' : 'bg-transparent'
                            }`}
                          >
                            <Text className="text-xs font-bold text-pine">
                              {at.name} ({at.code})
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

              {/* 3. Parent Auxiliar Dropdown (optional parent_id) */}
              <View>
                <Text className="mb-1 text-xs font-bold text-[#3B4F46]">
                  {t(AUXILIARS_CONSTANTS.PARENT_AUXILIAR_LABEL)}
                </Text>
                <Pressable
                  onPress={() =>
                    setOpenModalDropdown((prev) => (prev === 'parent' ? null : 'parent'))
                  }
                  className="flex-row items-center justify-between rounded-xl bg-white px-3.5 py-3 border border-[#DCECE3]"
                >
                  <Text className="text-sm font-bold text-[#12211B]">
                    {selectedModalParent
                      ? `${selectedModalParent.code} — ${selectedModalParent.name}`
                      : t(COMMON_CONSTANTS.NONE)}
                  </Text>
                  <Ionicons
                    name={openModalDropdown === 'parent' ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color="#0B3D2E"
                  />
                </Pressable>

                {openModalDropdown === 'parent' ? (
                  <View className="mt-1.5 max-h-44 rounded-xl bg-white p-1.5 border border-[#DCECE3]">
                    <ScrollView nestedScrollEnabled>
                      <Pressable
                        onPress={() => {
                          setParentId(null);
                          setOpenModalDropdown(null);
                        }}
                        className={`flex-row items-center justify-between rounded-lg px-3 py-2 ${
                          parentId === null ? 'bg-[#E6F4EC]' : 'bg-transparent'
                        }`}
                      >
                        <Text className="text-xs font-bold text-pine">
                          {t(COMMON_CONSTANTS.NONE)}
                        </Text>
                        {parentId === null ? (
                          <Ionicons name="checkmark-circle" size={16} color="#0B3D2E" />
                        ) : null}
                      </Pressable>

                      {availableParentAuxiliars.map((aux) => {
                        const selected = parentId === aux.id;
                        return (
                          <Pressable
                            key={aux.id}
                            onPress={() => {
                              setParentId(aux.id);
                              setOpenModalDropdown(null);
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

              {/* 4. Code & Name */}
              <View className="flex-row gap-2.5">
                <View className="w-36">
                  <Text className="mb-1 text-xs font-bold text-[#3B4F46]">
                    {t(COMMON_CONSTANTS.CODE)} (code) *
                  </Text>
                  <TextInput
                    value={code}
                    onChangeText={setCode}
                    autoCapitalize="characters"
                    placeholder="AUX-COMP"
                    placeholderTextColor="#8FA198"
                    className="rounded-xl bg-white px-3.5 py-2.5 text-sm text-[#12211B] border border-[#DCECE3]"
                  />
                </View>

                <View className="flex-1">
                  <Text className="mb-1 text-xs font-bold text-[#3B4F46]">
                    {t(COMMON_CONSTANTS.NAME)} (name) *
                  </Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Supermarket & Merchants"
                    placeholderTextColor="#8FA198"
                    className="rounded-xl bg-white px-3.5 py-2.5 text-sm text-[#12211B] border border-[#DCECE3]"
                  />
                </View>
              </View>

              {/* 5. Description */}
              <View>
                <Text className="mb-1 text-xs font-bold text-[#3B4F46]">
                  {t(COMMON_CONSTANTS.DESCRIPTION)} (description)
                </Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Vendor auxiliar for daily purchases"
                  placeholderTextColor="#8FA198"
                  className="rounded-xl bg-white px-3.5 py-2.5 text-sm text-[#12211B] border border-[#DCECE3]"
                />
              </View>

              {formError ? (
                <View className="rounded-2xl bg-red-50 p-3 border border-red-200">
                  <Text className="text-xs font-bold text-red-700">{formError}</Text>
                </View>
              ) : null}

              <Pressable
                onPress={() => void handleSave()}
                disabled={saving}
                className="mt-2 flex-row items-center justify-center rounded-2xl bg-pine py-4 shadow-md active:opacity-90 disabled:opacity-50"
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
                    <Text className="ml-2 text-sm font-extrabold text-white">
                      {editingAuxiliar
                        ? t(COMMON_CONSTANTS.SAVE_CHANGES)
                        : t(AUXILIARS_CONSTANTS.CREATE_BTN)}
                    </Text>
                  </>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Confirm Logical Delete Auxiliar Modal */}
      <Modal
        visible={Boolean(auxiliarToDelete)}
        animationType="fade"
        transparent
        onRequestClose={() => setAuxiliarToDelete(null)}
      >
        <View className="flex-1 items-center justify-center bg-black/40 px-5">
          <View className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-[#FFF5F5] self-center">
              <Feather name="trash-2" size={22} color="#C53030" />
            </View>
            <Text className="mt-3 text-center text-lg font-extrabold text-[#12211B]">
              {t(AUXILIARS_CONSTANTS.DELETE_TITLE)}
            </Text>
            <Text className="mt-1.5 text-center text-[13px] text-[#5A6D64]">
              <Text className="font-bold text-[#12211B]">
                {auxiliarToDelete?.code} — {auxiliarToDelete?.name}
              </Text>{' '}
              — {t(COMMON_CONSTANTS.LOGICAL_DELETE_DESC)}
            </Text>

            {deleteError ? (
              <View className="mt-3 rounded-xl bg-red-50 p-3">
                <Text className="text-xs font-bold text-red-700">{deleteError}</Text>
              </View>
            ) : null}

            <View className="mt-5 flex-row gap-2.5">
              <Pressable
                onPress={() => setAuxiliarToDelete(null)}
                disabled={deleting}
                className="flex-1 items-center justify-center rounded-2xl bg-[#E8F4ED] py-3"
              >
                <Text className="text-xs font-extrabold text-pine">
                  {t(COMMON_CONSTANTS.CANCEL)}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => void handleConfirmDelete()}
                disabled={deleting}
                className="flex-1 items-center justify-center rounded-2xl bg-[#C53030] py-3"
              >
                {deleting ? (
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

