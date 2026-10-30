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
import type { BudgetRow, BudgetTypeRow, HouseholdRow } from '../lib/budget-schema';
import { BUDGET_CONSTANTS, COMMON_CONSTANTS } from '../i18n/constants';

interface BudgetsViewProps {
  currentUserId: string;
  activeHousehold?: HouseholdRow | null;
}

function formatAmount(value: number, currency = 'BOB'): string {
  const rounded = Math.round(value).toString();
  const withDots = rounded.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${currency} ${withDots}`;
}

export default function BudgetsView({ currentUserId, activeHousehold }: BudgetsViewProps) {
  const { t } = useTranslation();
  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [households, setHouseholds] = useState<HouseholdRow[]>([]);
  const [budgetTypes, setBudgetTypes] = useState<BudgetTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Top filter dropdown by household_id
  const [selectedHouseholdFilter, setSelectedHouseholdFilter] = useState<string>(
    activeHousehold?.id ?? 'ALL',
  );
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);

  // Create / Edit modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetRow | null>(null);
  const [householdId, setHouseholdId] = useState<string>('');
  const [budgetTypeId, setBudgetTypeId] = useState<string>('');
  const [monthlyLimit, setMonthlyLimit] = useState('');
  const [openModalDropdown, setOpenModalDropdown] = useState<
    'household' | 'budget_type' | null
  >(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Logical Delete confirmation modal state
  const [budgetToDelete, setBudgetToDelete] = useState<BudgetRow | null>(null);
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

  // Load active non-deleted budgets, households, and budget types
  const loadBudgetsData = async () => {
    setLoading(true);
    try {
      const [bRes, hhRes, btRes] = await Promise.all([
        supabase
          .schema('budget')
          .from('tbudget')
          .select('*')
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
        supabase
          .schema('budget')
          .from('thousehold')
          .select('*')
          .is('deleted_at', null)
          .order('name', { ascending: true }),
        supabase
          .schema('budget')
          .from('tbudget_type')
          .select('*')
          .is('deleted_at', null)
          .order('name', { ascending: true }),
      ]);

      setBudgets(bRes.data ?? []);
      setHouseholds(hhRes.data ?? []);
      setBudgetTypes(btRes.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBudgetsData();
  }, []);

  const householdMap = useMemo(
    () => new Map(households.map((h) => [h.id, h])),
    [households],
  );
  const budgetTypeMap = useMemo(
    () => new Map(budgetTypes.map((bt) => [bt.id, bt])),
    [budgetTypes],
  );

  // Filter budgets by selected household_id and search query
  const filteredBudgets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return budgets.filter((item) => {
      if (
        selectedHouseholdFilter !== 'ALL' &&
        item.household_id !== selectedHouseholdFilter
      ) {
        return false;
      }
      if (!q) return true;
      const hhName = (item.household_id && householdMap.get(item.household_id)?.name) || '';
      const bt = item.budget_type_id ? budgetTypeMap.get(item.budget_type_id) : undefined;
      const btText = bt ? `${bt.name} ${bt.category_key} ${bt.description ?? ''}` : '';
      return (
        hhName.toLowerCase().includes(q) ||
        btText.toLowerCase().includes(q) ||
        String(item.monthly_limit).includes(q)
      );
    });
  }, [budgets, selectedHouseholdFilter, searchQuery, householdMap, budgetTypeMap]);

  const totalMonthlyLimit = useMemo(
    () =>
      filteredBudgets.reduce((acc, item) => acc + (Number(item.monthly_limit) || 0), 0),
    [filteredBudgets],
  );

  // Open Create modal
  const handleOpenCreate = () => {
    setEditingBudget(null);
    setHouseholdId(
      selectedHouseholdFilter !== 'ALL'
        ? selectedHouseholdFilter
        : activeHousehold?.id ?? households[0]?.id ?? '',
    );
    setBudgetTypeId(budgetTypes[0]?.id ?? '');
    setMonthlyLimit('');
    setOpenModalDropdown(null);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open Edit modal pre-populated with selected record
  const handleOpenEdit = (item: BudgetRow) => {
    setEditingBudget(item);
    setHouseholdId(item.household_id ?? households[0]?.id ?? '');
    setBudgetTypeId(item.budget_type_id ?? budgetTypes[0]?.id ?? '');
    setMonthlyLimit(String(item.monthly_limit ?? ''));
    setOpenModalDropdown(null);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Save Budget (Create or Update)
  const handleSave = async () => {
    setFormError(null);
    if (!householdId) {
      setFormError('Selecciona un Household (household_id) del desplegable.');
      return;
    }
    if (!budgetTypeId) {
      setFormError('Selecciona un Budget Type (budget_type_id) del desplegable.');
      return;
    }

    const parsedLimit = parseFloat(monthlyLimit.replace(/[^0-9.]/g, ''));
    if (Number.isNaN(parsedLimit) || parsedLimit <= 0) {
      setFormError('Ingresa un límite mensual (monthly_limit) válido mayor a 0.');
      return;
    }

    setSaving(true);
    try {
      const actorId = await resolveActorUserId();

      if (editingBudget) {
        const { error } = await supabase
          .schema('budget')
          .from('tbudget')
          .update({
            household_id: householdId,
            budget_type_id: budgetTypeId,
            monthly_limit: parsedLimit,
            updated_at: new Date().toISOString(),
            updated_by: actorId,
          })
          .eq('id', editingBudget.id);

        if (error) throw new Error(error.message);
      } else {
        // Check if a soft-deleted row already exists for (household_id, budget_type_id)
        const { data: existingRow } = await supabase
          .schema('budget')
          .from('tbudget')
          .select('id')
          .eq('household_id', householdId)
          .eq('budget_type_id', budgetTypeId)
          .maybeSingle();

        if (existingRow?.id) {
          const { error } = await supabase
            .schema('budget')
            .from('tbudget')
            .update({
              monthly_limit: parsedLimit,
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
            .from('tbudget')
            .insert({
              household_id: householdId,
              budget_type_id: budgetTypeId,
              monthly_limit: parsedLimit,
              status: 'active',
              created_by: actorId,
            });

          if (error) throw new Error(error.message);
        }
      }

      setIsModalOpen(false);
      await loadBudgetsData();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Error al guardar el presupuesto',
      );
    } finally {
      setSaving(false);
    }
  };

  // Confirm logical deletion (updates deleted_at and deleted_by)
  const handleConfirmDelete = async () => {
    if (!budgetToDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const actorId = await resolveActorUserId();
      const { error } = await supabase
        .schema('budget')
        .from('tbudget')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: actorId,
          status: 'inactive',
        })
        .eq('id', budgetToDelete.id);

      if (error) throw new Error(error.message);

      setBudgetToDelete(null);
      await loadBudgetsData();
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : 'No se pudo eliminar el presupuesto',
      );
    } finally {
      setDeleting(false);
    }
  };

  const selectedFilterHhLabel =
    selectedHouseholdFilter === 'ALL'
      ? t(BUDGET_CONSTANTS.ALL_HOUSEHOLDS)
      : householdMap.get(selectedHouseholdFilter)?.name ?? 'Household';

  const selectedModalHousehold = householdMap.get(householdId);
  const selectedModalBudgetType = budgetTypeMap.get(budgetTypeId);

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
              budget.tbudget • {filteredBudgets.length} {t(COMMON_CONSTANTS.RECORDS).toLowerCase()} •{' '}
              {t(BUDGET_CONSTANTS.TOTAL_BUDGETED)}: {formatAmount(totalMonthlyLimit)}
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
                {t(BUDGET_CONSTANTS.ALL_HOUSEHOLDS)}
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
              placeholder={t(BUDGET_CONSTANTS.SEARCH_PLACEHOLDER)}
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
            onPress={() => void loadBudgetsData()}
            className="h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm border border-[#E5F0EA] active:bg-[#E8F4ED]"
            accessibilityLabel={t(COMMON_CONSTANTS.REFRESH)}
          >
            <Ionicons name="refresh" size={20} color="#0B3D2E" />
          </Pressable>
        </View>

        {/* Budgets List in Journal Card Style */}
        {loading ? (
          <View className="py-10 items-center">
            <ActivityIndicator size="large" color="#0B3D2E" />
          </View>
        ) : filteredBudgets.length === 0 ? (
          <View className="mt-3 items-center rounded-3xl bg-white p-8 shadow-sm border border-[#E5F0EA]">
            <Ionicons name="wallet-outline" size={36} color="#9BA8A2" />
            <Text className="mt-3 text-[15px] font-bold text-[#12211B]">
              {t(BUDGET_CONSTANTS.EMPTY_TITLE)}
            </Text>
            <Text className="mt-1 text-center text-[13px] text-[#5A6D64]">
              {t(BUDGET_CONSTANTS.EMPTY_DESC)}
            </Text>
          </View>
        ) : (
          <View className="gap-2.5">
            {filteredBudgets.map((item) => {
              const hh = item.household_id ? householdMap.get(item.household_id) : undefined;
              const bt = item.budget_type_id
                ? budgetTypeMap.get(item.budget_type_id)
                : undefined;
              const currency = hh?.currency?.trim() || 'BOB';

              return (
                <View
                  key={item.id}
                  className="flex-row items-center justify-between rounded-3xl bg-white px-4 py-3.5 shadow-sm border border-[#E7F1EC]"
                >
                  {/* Left Circular Icon + Budget Info */}
                  <View className="flex-row items-center flex-1 mr-2">
                    <View
                      className="h-12 w-12 items-center justify-center rounded-full"
                      style={{ backgroundColor: '#E6F4EC' }}
                    >
                      <Ionicons name="wallet-outline" size={22} color="#0B3D2E" />
                    </View>

                    <View className="ml-3 flex-1">
                      <View className="flex-row items-center flex-wrap gap-1.5">
                        <Text
                          className="text-[15px] font-extrabold text-[#12211B]"
                          numberOfLines={1}
                        >
                          {bt?.name ?? 'Category'}
                        </Text>

                        {bt ? (
                          <View className="rounded-full bg-[#DFF5E8] px-2.5 py-0.5">
                            <Text className="text-[10px] font-extrabold text-[#0B3D2E]">
                              {bt.category_key}
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

                        <View className="rounded-full bg-[#FFF1E6] px-2.5 py-0.5">
                          <Text className="text-[11px] font-extrabold text-[#9A4B1A]">
                            {formatAmount(Number(item.monthly_limit) || 0, currency)}{' '}
                            {t(BUDGET_CONSTANTS.PER_MONTH)}
                          </Text>
                        </View>
                      </View>

                      <View className="mt-1 flex-row items-center">
                        <View className="h-4 w-4 items-center justify-center rounded-full bg-[#D9EBE0]">
                          <Text className="text-[8px] font-extrabold text-pine">
                            {((hh?.name ?? 'H')[0] ?? 'H').toUpperCase()}
                          </Text>
                        </View>
                        <Text
                          className="ml-1.5 text-[12px] font-medium text-[#5A6D64] flex-1"
                          numberOfLines={1}
                        >
                          {hh
                            ? `${t(BUDGET_CONSTANTS.HOUSEHOLD_PREFIX)} ${hh.name}`
                            : t(COMMON_CONSTANTS.NONE)}
                          {bt?.description ? ` • ${bt.description}` : ''}
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
                        setBudgetToDelete(item);
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
        accessibilityLabel={t(BUDGET_CONSTANTS.NEW_TITLE)}
      >
        <Ionicons name="add" size={32} color="#FFFFFF" />
      </Pressable>

      {/* Create / Edit Budget Modal */}
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
                  budget.tbudget
                </Text>
                <Text className="text-xl font-extrabold text-pine">
                  {editingBudget
                    ? t(BUDGET_CONSTANTS.EDIT_TITLE)
                    : t(BUDGET_CONSTANTS.NEW_TITLE)}
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
                  {t(BUDGET_CONSTANTS.HOUSEHOLD_FK_LABEL)}
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
                      : t(BUDGET_CONSTANTS.HOUSEHOLD_FK_LABEL)}
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

              {/* 2. Budget Type FK Dropdown (budget.tbudget_type) */}
              <View>
                <Text className="mb-1 text-xs font-bold text-[#3B4F46]">
                  {t(BUDGET_CONSTANTS.BUDGET_TYPE_FK_LABEL)}
                </Text>
                <Pressable
                  onPress={() =>
                    setOpenModalDropdown((prev) =>
                      prev === 'budget_type' ? null : 'budget_type',
                    )
                  }
                  className="flex-row items-center justify-between rounded-xl bg-white px-3.5 py-3 border border-[#DCECE3]"
                >
                  <Text className="text-sm font-bold text-[#12211B]">
                    {selectedModalBudgetType
                      ? `${selectedModalBudgetType.name} (${selectedModalBudgetType.category_key})`
                      : t(BUDGET_CONSTANTS.BUDGET_TYPE_FK_LABEL)}
                  </Text>
                  <Ionicons
                    name={openModalDropdown === 'budget_type' ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color="#0B3D2E"
                  />
                </Pressable>

                {openModalDropdown === 'budget_type' ? (
                  <View className="mt-1.5 max-h-52 rounded-xl bg-white p-1.5 border border-[#DCECE3]">
                    <ScrollView nestedScrollEnabled>
                      {budgetTypes.map((bt) => {
                        const selected = budgetTypeId === bt.id;
                        return (
                          <Pressable
                            key={bt.id}
                            onPress={() => {
                              setBudgetTypeId(bt.id);
                              setOpenModalDropdown(null);
                            }}
                            className={`flex-row items-center justify-between rounded-lg px-3 py-2 ${
                              selected ? 'bg-[#E6F4EC]' : 'bg-transparent'
                            }`}
                          >
                            <View className="flex-1 mr-2">
                              <Text className="text-xs font-bold text-pine">{bt.name}</Text>
                              <Text className="text-[10px] text-[#5A6D64]">
                                {bt.category_key}
                              </Text>
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

              {/* 3. Monthly Limit */}
              <View>
                <Text className="mb-1 text-xs font-bold text-[#3B4F46]">
                  {t(BUDGET_CONSTANTS.MONTHLY_LIMIT_LABEL)}
                </Text>
                <TextInput
                  value={monthlyLimit}
                  onChangeText={setMonthlyLimit}
                  keyboardType="numeric"
                  placeholder="2500"
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
                      {editingBudget
                        ? t(COMMON_CONSTANTS.SAVE_CHANGES)
                        : t(BUDGET_CONSTANTS.CREATE_BTN)}
                    </Text>
                  </>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Confirm Logical Delete Budget Modal */}
      <Modal
        visible={Boolean(budgetToDelete)}
        animationType="fade"
        transparent
        onRequestClose={() => setBudgetToDelete(null)}
      >
        <View className="flex-1 items-center justify-center bg-black/40 px-5">
          <View className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-[#FFF5F5] self-center">
              <Feather name="trash-2" size={22} color="#C53030" />
            </View>
            <Text className="mt-3 text-center text-lg font-extrabold text-[#12211B]">
              {t(BUDGET_CONSTANTS.DELETE_TITLE)}
            </Text>
            <Text className="mt-1.5 text-center text-[13px] text-[#5A6D64]">
              <Text className="font-bold text-[#12211B]">
                {(budgetToDelete?.budget_type_id &&
                  budgetTypeMap.get(budgetToDelete.budget_type_id)?.name) ||
                  ''}
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
                onPress={() => setBudgetToDelete(null)}
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

