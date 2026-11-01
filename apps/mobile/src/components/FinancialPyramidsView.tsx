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
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { COMMON_CONSTANTS, FINANCIAL_PYRAMIDS_CONSTANTS } from '../i18n/constants';
import type {
  BusinessTypeRow,
  FinancialPyramidLevelRow,
  FinancialPyramidRow,
} from '../lib/budget-schema';

interface FinancialPyramidsViewProps {
  currentUserId: string;
}

export default function FinancialPyramidsView({ currentUserId }: FinancialPyramidsViewProps) {
  const { t } = useTranslation();
  const [pyramids, setPyramids] = useState<FinancialPyramidRow[]>([]);
  const [businessTypes, setBusinessTypes] = useState<BusinessTypeRow[]>([]);
  const [levelCounts, setLevelCounts] = useState<Record<string, number>>({});
  const [loadingPyramids, setLoadingPyramids] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Create / Edit Pyramid modal state (no household_id)
  const [isPyramidModalOpen, setIsPyramidModalOpen] = useState(false);
  const [editingPyramid, setEditingPyramid] = useState<FinancialPyramidRow | null>(null);
  const [businessTypeId, setBusinessTypeId] = useState<string>('');
  const [isBusinessTypeDropdownOpen, setIsBusinessTypeDropdownOpen] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [savingPyramid, setSavingPyramid] = useState(false);
  const [pyramidFormError, setPyramidFormError] = useState<string | null>(null);

  // Logical Delete Pyramid confirmation modal state
  const [pyramidToDelete, setPyramidToDelete] = useState<FinancialPyramidRow | null>(null);
  const [deletingPyramid, setDeletingPyramid] = useState(false);
  const [deletePyramidError, setDeletePyramidError] = useState<string | null>(null);

  // Levels Sub-View state (budget.tfinancial_pyramid_level)
  const [selectedPyramidForLevels, setSelectedPyramidForLevels] =
    useState<FinancialPyramidRow | null>(null);
  const [levels, setLevels] = useState<FinancialPyramidLevelRow[]>([]);
  const [loadingLevels, setLoadingLevels] = useState(false);
  const [levelSearchQuery, setLevelSearchQuery] = useState('');

  // Create / Edit Level modal state
  const [isLevelModalOpen, setIsLevelModalOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState<FinancialPyramidLevelRow | null>(null);
  const [levelCode, setLevelCode] = useState('');
  const [levelName, setLevelName] = useState('');
  const [levelOrderBy, setLevelOrderBy] = useState('1');
  const [minPercentage, setMinPercentage] = useState('0');
  const [maxPercentage, setMaxPercentage] = useState('0');
  const [savingLevel, setSavingLevel] = useState(false);
  const [levelFormError, setLevelFormError] = useState<string | null>(null);

  // Logical Delete Level confirmation modal state
  const [levelToDelete, setLevelToDelete] = useState<FinancialPyramidLevelRow | null>(null);
  const [deletingLevel, setDeletingLevel] = useState(false);
  const [deleteLevelError, setDeleteLevelError] = useState<string | null>(null);

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

  // Load active non-deleted pyramids, business types, and level counts
  const loadPyramidsData = async () => {
    setLoadingPyramids(true);
    try {
      const [pyrRes, bizRes, lvlRes] = await Promise.all([
        supabase
          .schema('budget')
          .from('tfinancial_pyramid')
          .select('*')
          .is('deleted_at', null)
          .is('household_id', null)
          .order('created_at', { ascending: false }),
        supabase
          .schema('budget')
          .from('tbusiness_type')
          .select('*')
          .is('deleted_at', null)
          .order('name', { ascending: true }),
        supabase
          .schema('budget')
          .from('tfinancial_pyramid_level')
          .select('id, financial_pyramid_id')
          .is('deleted_at', null),
      ]);

      setPyramids(pyrRes.data ?? []);
      setBusinessTypes(bizRes.data ?? []);

      if (lvlRes.data) {
        const counts: Record<string, number> = {};
        for (const lvl of lvlRes.data) {
          counts[lvl.financial_pyramid_id] = (counts[lvl.financial_pyramid_id] ?? 0) + 1;
        }
        setLevelCounts(counts);
      }
    } finally {
      setLoadingPyramids(false);
    }
  };

  // Load active non-deleted levels for a specific pyramid
  const loadPyramidLevels = async (pyramidId: string) => {
    setLoadingLevels(true);
    try {
      const { data } = await supabase
        .schema('budget')
        .from('tfinancial_pyramid_level')
        .select('*')
        .eq('financial_pyramid_id', pyramidId)
        .is('deleted_at', null)
        .order('order_by', { ascending: true });

      const list = data ?? [];
      setLevels(list);
      setLevelCounts((prev) => ({
        ...prev,
        [pyramidId]: list.length,
      }));
    } finally {
      setLoadingLevels(false);
    }
  };

  useEffect(() => {
    void loadPyramidsData();
  }, []);

  useEffect(() => {
    if (selectedPyramidForLevels) {
      void loadPyramidLevels(selectedPyramidForLevels.id);
    }
  }, [selectedPyramidForLevels?.id]);

  const businessTypeMap = useMemo(
    () => new Map(businessTypes.map((b) => [b.id, b])),
    [businessTypes],
  );

  // Filtered pyramids (excluding any household-specific pyramids)
  const filteredPyramids = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    // Exclude records where household_id is not null
    const basePyramids = pyramids.filter(
      (p) => p.household_id === null || p.household_id === undefined,
    );
    if (!q) return basePyramids;
    return basePyramids.filter((p) => {
      const bizName =
        (p.business_type_id && businessTypeMap.get(p.business_type_id)?.name) || '';
      return (
        (p.name ?? '').toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q) ||
        bizName.toLowerCase().includes(q)
      );
    });
  }, [pyramids, searchQuery, businessTypeMap]);

  // Filtered levels
  const filteredLevels = useMemo(() => {
    const q = levelSearchQuery.trim().toLowerCase();
    if (!q) return levels;
    return levels.filter(
      (l) =>
        (l.name ?? '').toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q),
    );
  }, [levels, levelSearchQuery]);

  // Open Create Pyramid modal
  const handleOpenCreatePyramid = () => {
    setEditingPyramid(null);
    setBusinessTypeId(businessTypes[0]?.id ?? '');
    setIsBusinessTypeDropdownOpen(false);
    setCode('');
    setName('');
    setDescription('');
    setPyramidFormError(null);
    setIsPyramidModalOpen(true);
  };

  // Open Edit Pyramid modal
  const handleOpenEditPyramid = (pyramid: FinancialPyramidRow) => {
    setEditingPyramid(pyramid);
    setBusinessTypeId(pyramid.business_type_id ?? businessTypes[0]?.id ?? '');
    setIsBusinessTypeDropdownOpen(false);
    setCode(pyramid.code);
    setName(pyramid.name ?? '');
    setDescription(pyramid.description ?? '');
    setPyramidFormError(null);
    setIsPyramidModalOpen(true);
  };

  // Save Pyramid (Create or Update without household_id)
  const handleSavePyramid = async () => {
    setPyramidFormError(null);
    if (!businessTypeId) {
      setPyramidFormError('Selecciona un Business Type del desplegable.');
      return;
    }
    if (!code.trim()) {
      setPyramidFormError('El código es obligatorio (ej. standard_50_30_20).');
      return;
    }
    if (!name.trim()) {
      setPyramidFormError('El nombre es obligatorio.');
      return;
    }

    setSavingPyramid(true);
    try {
      const actorId = await resolveActorUserId();

      if (editingPyramid) {
        const { error } = await supabase
          .schema('budget')
          .from('tfinancial_pyramid')
          .update({
            business_type_id: businessTypeId,
            code: code.trim().toLowerCase(),
            name: name.trim(),
            description: description.trim() || null,
            updated_at: new Date().toISOString(),
            updated_by: actorId,
          })
          .eq('id', editingPyramid.id);

        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .schema('budget')
          .from('tfinancial_pyramid')
          .insert({
            business_type_id: businessTypeId,
            code: code.trim().toLowerCase(),
            name: name.trim(),
            description: description.trim() || null,
            status: 'active',
            created_by: actorId,
          });

        if (error) throw new Error(error.message);
      }

      setIsPyramidModalOpen(false);
      await loadPyramidsData();
    } catch (err) {
      setPyramidFormError(
        err instanceof Error ? err.message : 'Error al guardar la pirámide financiera',
      );
    } finally {
      setSavingPyramid(false);
    }
  };

  // Confirm logical deletion of Pyramid
  const handleConfirmDeletePyramid = async () => {
    if (!pyramidToDelete) return;
    setDeletingPyramid(true);
    setDeletePyramidError(null);
    try {
      const actorId = await resolveActorUserId();
      const { error } = await supabase
        .schema('budget')
        .from('tfinancial_pyramid')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: actorId,
          status: 'inactive',
        })
        .eq('id', pyramidToDelete.id);

      if (error) throw new Error(error.message);

      setPyramidToDelete(null);
      await loadPyramidsData();
    } catch (err) {
      setDeletePyramidError(
        err instanceof Error ? err.message : 'No se pudo eliminar la pirámide',
      );
    } finally {
      setDeletingPyramid(false);
    }
  };

  // Open Create Level modal
  const handleOpenCreateLevel = () => {
    setEditingLevel(null);
    setLevelCode('');
    setLevelName('');
    setLevelOrderBy(String(levels.length + 1));
    setMinPercentage('0');
    setMaxPercentage('50');
    setLevelFormError(null);
    setIsLevelModalOpen(true);
  };

  // Open Edit Level modal
  const handleOpenEditLevel = (level: FinancialPyramidLevelRow) => {
    setEditingLevel(level);
    setLevelCode(level.code);
    setLevelName(level.name ?? '');
    setLevelOrderBy(String(level.order_by ?? 1));
    setMinPercentage(String(level.min_percentage ?? 0));
    setMaxPercentage(String(level.max_percentage ?? 0));
    setLevelFormError(null);
    setIsLevelModalOpen(true);
  };

  // Save Level (Create or Update in budget.tfinancial_pyramid_level)
  const handleSaveLevel = async () => {
    if (!selectedPyramidForLevels) return;
    setLevelFormError(null);

    if (!levelCode.trim()) {
      setLevelFormError('El código del nivel es obligatorio (ej. base_needs, lifestyle, savings).');
      return;
    }
    if (!levelName.trim()) {
      setLevelFormError('El nombre del nivel es obligatorio.');
      return;
    }

    const parsedOrder = parseInt(levelOrderBy, 10) || 1;
    const parsedMin = parseFloat(minPercentage) || 0;
    const parsedMax = parseFloat(maxPercentage) || 0;

    setSavingLevel(true);
    try {
      const actorId = await resolveActorUserId();

      if (editingLevel) {
        const { error } = await supabase
          .schema('budget')
          .from('tfinancial_pyramid_level')
          .update({
            code: levelCode.trim().toLowerCase(),
            name: levelName.trim(),
            order_by: parsedOrder,
            min_percentage: parsedMin,
            max_percentage: parsedMax,
            updated_at: new Date().toISOString(),
            updated_by: actorId,
          })
          .eq('id', editingLevel.id);

        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .schema('budget')
          .from('tfinancial_pyramid_level')
          .insert({
            financial_pyramid_id: selectedPyramidForLevels.id,
            code: levelCode.trim().toLowerCase(),
            name: levelName.trim(),
            order_by: parsedOrder,
            min_percentage: parsedMin,
            max_percentage: parsedMax,
            status: 'active',
            created_by: actorId,
          });

        if (error) throw new Error(error.message);
      }

      setIsLevelModalOpen(false);
      await loadPyramidLevels(selectedPyramidForLevels.id);
    } catch (err) {
      setLevelFormError(err instanceof Error ? err.message : 'Error al guardar el nivel');
    } finally {
      setSavingLevel(false);
    }
  };

  // Confirm logical deletion of Level
  const handleConfirmDeleteLevel = async () => {
    if (!levelToDelete || !selectedPyramidForLevels) return;
    setDeletingLevel(true);
    setDeleteLevelError(null);
    try {
      const actorId = await resolveActorUserId();
      const { error } = await supabase
        .schema('budget')
        .from('tfinancial_pyramid_level')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: actorId,
          status: 'inactive',
        })
        .eq('id', levelToDelete.id);

      if (error) throw new Error(error.message);

      setLevelToDelete(null);
      await loadPyramidLevels(selectedPyramidForLevels.id);
    } catch (err) {
      setDeleteLevelError(err instanceof Error ? err.message : 'No se pudo eliminar el nivel');
    } finally {
      setDeletingLevel(false);
    }
  };

  const selectedModalBusinessType = businessTypeMap.get(businessTypeId);

  // ============================================================================
  // PYRAMID LEVELS SUB-INTERFACE (budget.tfinancial_pyramid_level)
  // ============================================================================
  if (selectedPyramidForLevels) {
    const parentBizType = selectedPyramidForLevels.business_type_id
      ? businessTypeMap.get(selectedPyramidForLevels.business_type_id)
      : undefined;

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
                setSelectedPyramidForLevels(null);
                setLevelSearchQuery('');
              }}
              className="flex-row items-center rounded-full bg-[#DCECE3] px-3.5 py-2 active:bg-[#CBE2D5]"
            >
              <Ionicons name="arrow-back" size={16} color="#0B3D2E" />
              <Text className="ml-1.5 text-[13px] font-bold text-pine">
                {t(FINANCIAL_PYRAMIDS_CONSTANTS.BACK_TO_PYRAMIDS)}
              </Text>
            </Pressable>

            <View className="rounded-full bg-[#E6F4EC] px-3 py-1">
              <Text className="text-[11px] font-extrabold text-pine">
                budget.tfinancial_pyramid_level • {levels.length}{' '}
                {levels.length === 1
                  ? t(FINANCIAL_PYRAMIDS_CONSTANTS.LEVEL_SINGULAR)
                  : t(FINANCIAL_PYRAMIDS_CONSTANTS.LEVEL_PLURAL)}
              </Text>
            </View>
          </View>

          {/* Selected Pyramid Context Banner */}
          <View className="mb-4 rounded-3xl bg-white p-4 shadow-sm border border-[#E5F0EA] flex-row items-center justify-between">
            <View className="flex-row items-center flex-1">
              <View className="h-11 w-11 items-center justify-center rounded-full bg-pine">
                <MaterialCommunityIcons name="triangle-outline" size={20} color="#FFFFFF" />
              </View>
              <View className="ml-3 flex-1">
                <View className="flex-row items-center flex-wrap gap-1.5">
                  <Text className="text-[11px] font-extrabold uppercase tracking-wider text-[#5A6D64]">
                    {t(FINANCIAL_PYRAMIDS_CONSTANTS.LEVELS_HEADER)}
                  </Text>
                  {parentBizType ? (
                    <View className="rounded-full bg-[#E3ECE7] px-2 py-0.5">
                      <Text className="text-[10px] font-bold text-[#3B4F46]">
                        {parentBizType.name}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text className="text-[16px] font-extrabold text-[#12211B]" numberOfLines={1}>
                  {selectedPyramidForLevels.name || selectedPyramidForLevels.code}
                </Text>
                <Text className="text-[12px] text-[#5A6D64]" numberOfLines={1}>
                  {t(COMMON_CONSTANTS.CODE)}: {selectedPyramidForLevels.code}
                  {selectedPyramidForLevels.description
                    ? ` • ${selectedPyramidForLevels.description}`
                    : ''}
                </Text>
              </View>
            </View>
          </View>

          {/* Search Input + Refresh */}
          <View className="flex-row items-center gap-2.5 mb-4">
            <View className="flex-1 flex-row items-center rounded-2xl bg-white px-4 py-3 shadow-sm border border-[#E5F0EA]">
              <Ionicons name="search-outline" size={20} color="#7A8C83" />
              <TextInput
                value={levelSearchQuery}
                onChangeText={setLevelSearchQuery}
                placeholder={t(FINANCIAL_PYRAMIDS_CONSTANTS.SEARCH_LEVEL_PLACEHOLDER)}
                placeholderTextColor="#7A8C83"
                className="ml-2.5 flex-1 text-[15px] text-pine"
              />
              {levelSearchQuery ? (
                <Pressable onPress={() => setLevelSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color="#9BA8A2" />
                </Pressable>
              ) : null}
            </View>

            <Pressable
              onPress={() => void loadPyramidLevels(selectedPyramidForLevels.id)}
              className="h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm border border-[#E5F0EA] active:bg-[#E8F4ED]"
              accessibilityLabel={t(COMMON_CONSTANTS.REFRESH)}
            >
              <Ionicons name="refresh" size={20} color="#0B3D2E" />
            </Pressable>
          </View>

          {/* Pyramid Levels Cards List */}
          {loadingLevels ? (
            <View className="py-10 items-center">
              <ActivityIndicator size="large" color="#0B3D2E" />
            </View>
          ) : filteredLevels.length === 0 ? (
            <View className="mt-2 items-center rounded-3xl bg-white p-8 shadow-sm border border-[#E5F0EA]">
              <Ionicons name="layers-outline" size={36} color="#9BA8A2" />
              <Text className="mt-3 text-[15px] font-bold text-[#12211B]">
                {t(FINANCIAL_PYRAMIDS_CONSTANTS.EMPTY_LEVELS_TITLE)}
              </Text>
              <Text className="mt-1 text-center text-[13px] text-[#5A6D64]">
                {t(FINANCIAL_PYRAMIDS_CONSTANTS.EMPTY_LEVELS_DESC, {
                  name: selectedPyramidForLevels.name || selectedPyramidForLevels.code,
                })}
              </Text>
            </View>
          ) : (
            <View className="gap-2.5">
              {filteredLevels.map((lvl) => (
                <View
                  key={lvl.id}
                  className="flex-row items-center justify-between rounded-3xl bg-white px-4 py-3.5 shadow-sm border border-[#E7F1EC]"
                >
                  {/* Left Order Badge + Level Info (Journal Card style) */}
                  <View className="flex-row items-center flex-1 mr-2">
                    <View
                      className="h-12 w-12 items-center justify-center rounded-full"
                      style={{ backgroundColor: '#E6F4EC' }}
                    >
                      <Text className="text-[14px] font-extrabold text-pine">
                        #{lvl.order_by ?? 1}
                      </Text>
                    </View>

                    <View className="ml-3 flex-1">
                      <View className="flex-row items-center flex-wrap gap-1.5">
                        <Text
                          className="text-[15px] font-extrabold text-[#12211B]"
                          numberOfLines={1}
                        >
                          {lvl.name || lvl.code}
                        </Text>
                        <View className="rounded-full bg-[#DFF5E8] px-2.5 py-0.5">
                          <Text className="text-[10px] font-extrabold text-[#0B3D2E]">
                            {lvl.code}
                          </Text>
                        </View>
                        <View className="rounded-full bg-[#FFF1E6] px-2.5 py-0.5">
                          <Text className="text-[10px] font-extrabold text-[#9A4B1A]">
                            {lvl.min_percentage}% – {lvl.max_percentage}%
                          </Text>
                        </View>
                      </View>

                      <View className="mt-1 flex-row items-center">
                        <View className="h-4 w-4 items-center justify-center rounded-full bg-[#D9EBE0]">
                          <Text className="text-[8px] font-extrabold text-pine">
                            {(lvl.code[0] ?? 'L').toUpperCase()}
                          </Text>
                        </View>
                        <Text
                          className="ml-1.5 text-[12px] font-medium text-[#5A6D64]"
                          numberOfLines={1}
                        >
                          {t(FINANCIAL_PYRAMIDS_CONSTANTS.ORDER_LABEL)}: {lvl.order_by ?? 1} •{' '}
                          {t(FINANCIAL_PYRAMIDS_CONSTANTS.RECOMMENDED_RANGE)}: {lvl.min_percentage}
                          % – {lvl.max_percentage}%
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Right Flat Action Icons: Edit & Delete */}
                  <View className="flex-row items-center gap-1.5">
                    <Pressable
                      onPress={() => handleOpenEditLevel(lvl)}
                      className="h-9 w-9 items-center justify-center rounded-full bg-[#F2F8F4] active:bg-[#DCECE3]"
                      accessibilityLabel={t(COMMON_CONSTANTS.EDIT)}
                    >
                      <Feather name="edit-2" size={16} color="#0B3D2E" />
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        setDeleteLevelError(null);
                        setLevelToDelete(lvl);
                      }}
                      className="h-9 w-9 items-center justify-center rounded-full bg-[#FFF5F5] active:bg-[#FED7D7]"
                      accessibilityLabel={t(COMMON_CONSTANTS.DELETE)}
                    >
                      <Feather name="trash-2" size={16} color="#C53030" />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Fixed Floating Action Button (+) for New Level */}
        <Pressable
          onPress={handleOpenCreateLevel}
          className="absolute bottom-5 right-5 h-16 w-16 items-center justify-center rounded-full bg-pine shadow-lg active:bg-pine-dark"
          accessibilityLabel={t(FINANCIAL_PYRAMIDS_CONSTANTS.NEW_LEVEL_TITLE)}
        >
          <Ionicons name="add" size={32} color="#FFFFFF" />
        </Pressable>

        {/* Create / Edit Level Modal */}
        <Modal
          visible={isLevelModalOpen}
          animationType="slide"
          transparent
          onRequestClose={() => setIsLevelModalOpen(false)}
        >
          <View className="flex-1 justify-end bg-black/40">
            <View className="max-h-[88%] rounded-t-3xl bg-[#F4FAF6] px-5 pt-5 pb-8">
              <View className="flex-row items-center justify-between pb-3 border-b border-[#DCECE3]">
                <View>
                  <Text className="text-[11px] font-extrabold uppercase tracking-wider text-sage">
                    budget.tfinancial_pyramid_level
                  </Text>
                  <Text className="text-xl font-extrabold text-pine">
                    {editingLevel
                      ? t(FINANCIAL_PYRAMIDS_CONSTANTS.EDIT_LEVEL_TITLE)
                      : t(FINANCIAL_PYRAMIDS_CONSTANTS.NEW_LEVEL_TITLE)}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setIsLevelModalOpen(false)}
                  className="h-9 w-9 items-center justify-center rounded-full bg-[#E2EFE8]"
                >
                  <Ionicons name="close" size={20} color="#0B3D2E" />
                </Pressable>
              </View>

              <ScrollView className="mt-4" contentContainerClassName="gap-3.5 pb-4">
                <View className="flex-row gap-2.5">
                  <View className="flex-1">
                    <Text className="mb-1 text-xs font-bold text-[#3B4F46]">
                      {t(COMMON_CONSTANTS.CODE)} (code) *
                    </Text>
                    <TextInput
                      value={levelCode}
                      onChangeText={setLevelCode}
                      autoCapitalize="none"
                      placeholder="base_needs, lifestyle"
                      placeholderTextColor="#8FA198"
                      className="rounded-xl bg-white px-3.5 py-2.5 text-sm text-[#12211B] border border-[#DCECE3]"
                    />
                  </View>

                  <View className="w-28">
                    <Text className="mb-1 text-xs font-bold text-[#3B4F46]">
                      {t(FINANCIAL_PYRAMIDS_CONSTANTS.ORDER_LABEL)} (order_by)
                    </Text>
                    <TextInput
                      value={levelOrderBy}
                      onChangeText={setLevelOrderBy}
                      keyboardType="numeric"
                      placeholder="1"
                      placeholderTextColor="#8FA198"
                      className="rounded-xl bg-white px-3.5 py-2.5 text-sm text-[#12211B] border border-[#DCECE3]"
                    />
                  </View>
                </View>

                <View>
                  <Text className="mb-1 text-xs font-bold text-[#3B4F46]">
                    {t(COMMON_CONSTANTS.NAME)} (name) *
                  </Text>
                  <TextInput
                    value={levelName}
                    onChangeText={setLevelName}
                    placeholder="Base Needs"
                    placeholderTextColor="#8FA198"
                    className="rounded-xl bg-white px-3.5 py-2.5 text-sm text-[#12211B] border border-[#DCECE3]"
                  />
                </View>

                <View className="flex-row gap-2.5">
                  <View className="flex-1">
                    <Text className="mb-1 text-xs font-bold text-[#3B4F46]">
                      {t(FINANCIAL_PYRAMIDS_CONSTANTS.MIN_PCT_LABEL)} *
                    </Text>
                    <TextInput
                      value={minPercentage}
                      onChangeText={setMinPercentage}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="#8FA198"
                      className="rounded-xl bg-white px-3.5 py-2.5 text-sm text-[#12211B] border border-[#DCECE3]"
                    />
                  </View>

                  <View className="flex-1">
                    <Text className="mb-1 text-xs font-bold text-[#3B4F46]">
                      {t(FINANCIAL_PYRAMIDS_CONSTANTS.MAX_PCT_LABEL)} *
                    </Text>
                    <TextInput
                      value={maxPercentage}
                      onChangeText={setMaxPercentage}
                      keyboardType="numeric"
                      placeholder="50"
                      placeholderTextColor="#8FA198"
                      className="rounded-xl bg-white px-3.5 py-2.5 text-sm text-[#12211B] border border-[#DCECE3]"
                    />
                  </View>
                </View>

                {levelFormError ? (
                  <View className="rounded-2xl bg-red-50 p-3 border border-red-200">
                    <Text className="text-xs font-bold text-red-700">{levelFormError}</Text>
                  </View>
                ) : null}

                <Pressable
                  onPress={() => void handleSaveLevel()}
                  disabled={savingLevel}
                  className="mt-2 flex-row items-center justify-center rounded-2xl bg-pine py-4 shadow-md active:opacity-90 disabled:opacity-50"
                >
                  {savingLevel ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
                      <Text className="ml-2 text-sm font-extrabold text-white">
                        {editingLevel
                          ? t(COMMON_CONSTANTS.SAVE_CHANGES)
                          : t(FINANCIAL_PYRAMIDS_CONSTANTS.CREATE_LEVEL_BTN)}
                      </Text>
                    </>
                  )}
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Confirm Logical Delete Level Modal */}
        <Modal
          visible={Boolean(levelToDelete)}
          animationType="fade"
          transparent
          onRequestClose={() => setLevelToDelete(null)}
        >
          <View className="flex-1 items-center justify-center bg-black/40 px-5">
            <View className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
              <View className="h-12 w-12 items-center justify-center rounded-full bg-[#FFF5F5] self-center">
                <Feather name="trash-2" size={22} color="#C53030" />
              </View>
              <Text className="mt-3 text-center text-lg font-extrabold text-[#12211B]">
                {t(FINANCIAL_PYRAMIDS_CONSTANTS.DELETE_LEVEL_TITLE)}
              </Text>
              <Text className="mt-1.5 text-center text-[13px] text-[#5A6D64]">
                {t(COMMON_CONSTANTS.LOGICAL_DELETE_DESC, {
                  name: levelToDelete?.name || levelToDelete?.code || '',
                })}
              </Text>

              {deleteLevelError ? (
                <View className="mt-3 rounded-xl bg-red-50 p-3">
                  <Text className="text-xs font-bold text-red-700">{deleteLevelError}</Text>
                </View>
              ) : null}

              <View className="mt-5 flex-row gap-2.5">
                <Pressable
                  onPress={() => setLevelToDelete(null)}
                  disabled={deletingLevel}
                  className="flex-1 items-center justify-center rounded-2xl bg-[#E8F4ED] py-3"
                >
                  <Text className="text-xs font-extrabold text-pine">
                    {t(COMMON_CONSTANTS.CANCEL)}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => void handleConfirmDeleteLevel()}
                  disabled={deletingLevel}
                  className="flex-1 items-center justify-center rounded-2xl bg-[#C53030] py-3"
                >
                  {deletingLevel ? (
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
  // MAIN FINANCIAL PYRAMIDS INTERFACE (budget.tfinancial_pyramid)
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
            <MaterialCommunityIcons name="triangle-outline" size={16} color="#0B3D2E" />
            <Text className="ml-2 text-[13px] font-bold text-pine">
              {t(FINANCIAL_PYRAMIDS_CONSTANTS.TITLE, { count: pyramids.length })}
            </Text>
          </View>

          <View className="rounded-full bg-[#E6F4EC] px-3 py-1">
            <Text className="text-[11px] font-extrabold text-pine">budget.tfinancial_pyramid</Text>
          </View>
        </View>

        {/* Search Input + Refresh Button */}
        <View className="flex-row items-center gap-2.5 mb-4">
          <View className="flex-1 flex-row items-center rounded-2xl bg-white px-4 py-3 shadow-sm border border-[#E5F0EA]">
            <Ionicons name="search-outline" size={20} color="#7A8C83" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t(FINANCIAL_PYRAMIDS_CONSTANTS.SEARCH_PLACEHOLDER)}
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
            onPress={() => void loadPyramidsData()}
            className="h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm border border-[#E5F0EA] active:bg-[#E8F4ED]"
            accessibilityLabel={t(COMMON_CONSTANTS.REFRESH)}
          >
            <Ionicons name="refresh" size={20} color="#0B3D2E" />
          </Pressable>
        </View>

        {/* Pyramids List in Journal Card Style */}
        {loadingPyramids ? (
          <View className="py-10 items-center">
            <ActivityIndicator size="large" color="#0B3D2E" />
          </View>
        ) : filteredPyramids.length === 0 ? (
          <View className="mt-3 items-center rounded-3xl bg-white p-8 shadow-sm border border-[#E5F0EA]">
            <MaterialCommunityIcons name="triangle-outline" size={36} color="#9BA8A2" />
            <Text className="mt-3 text-[15px] font-bold text-[#12211B]">
              {t(FINANCIAL_PYRAMIDS_CONSTANTS.EMPTY_TITLE)}
            </Text>
            <Text className="mt-1 text-center text-[13px] text-[#5A6D64]">
              {t(FINANCIAL_PYRAMIDS_CONSTANTS.EMPTY_DESC)}
            </Text>
          </View>
        ) : (
          <View className="gap-2.5">
            {filteredPyramids.map((pyramid) => {
              const bizType = pyramid.business_type_id
                ? businessTypeMap.get(pyramid.business_type_id)
                : undefined;
              const count = levelCounts[pyramid.id] ?? 0;

              return (
                <View
                  key={pyramid.id}
                  className="flex-row items-center justify-between rounded-3xl bg-white px-4 py-3.5 shadow-sm border border-[#E7F1EC]"
                >
                  {/* Left Circular Icon + Pyramid Details (Journal Card style) */}
                  <View className="flex-row items-center flex-1 mr-2">
                    <View
                      className="h-12 w-12 items-center justify-center rounded-full"
                      style={{ backgroundColor: '#E6F4EC' }}
                    >
                      <MaterialCommunityIcons
                        name="triangle-outline"
                        size={22}
                        color="#0B3D2E"
                      />
                    </View>

                    <View className="ml-3 flex-1">
                      <View className="flex-row items-center flex-wrap gap-1.5">
                        <Text
                          className="text-[15px] font-extrabold text-[#12211B]"
                          numberOfLines={1}
                        >
                          {pyramid.name || pyramid.code}
                        </Text>
                        <View className="rounded-full bg-[#DFF5E8] px-2.5 py-0.5">
                          <Text className="text-[10px] font-extrabold text-[#0B3D2E]">
                            {pyramid.code}
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
                              ? t(FINANCIAL_PYRAMIDS_CONSTANTS.LEVEL_SINGULAR)
                              : t(FINANCIAL_PYRAMIDS_CONSTANTS.LEVEL_PLURAL)}
                          </Text>
                        </View>
                      </View>

                      <View className="mt-1 flex-row items-center">
                        <View className="h-4 w-4 items-center justify-center rounded-full bg-[#D9EBE0]">
                          <Text className="text-[8px] font-extrabold text-pine">
                            {((pyramid.name ?? pyramid.code)[0] ?? 'P').toUpperCase()}
                          </Text>
                        </View>
                        <Text
                          className="ml-1.5 text-[12px] font-medium text-[#5A6D64] flex-1"
                          numberOfLines={1}
                        >
                          {pyramid.description || `${t(COMMON_CONSTANTS.CODE)}: ${pyramid.code}`}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Right Flat Action Icons: Define Levels, Edit, Delete */}
                  <View className="flex-row items-center gap-1.5">
                    <Pressable
                      onPress={() => setSelectedPyramidForLevels(pyramid)}
                      className="h-9 w-9 items-center justify-center rounded-full bg-[#E6F4EC] active:bg-[#CDE6D8]"
                      accessibilityLabel={t(FINANCIAL_PYRAMIDS_CONSTANTS.LEVELS_HEADER)}
                    >
                      <Ionicons name="layers-outline" size={17} color="#0B3D2E" />
                    </Pressable>

                    <Pressable
                      onPress={() => handleOpenEditPyramid(pyramid)}
                      className="h-9 w-9 items-center justify-center rounded-full bg-[#F2F8F4] active:bg-[#DCECE3]"
                      accessibilityLabel={t(COMMON_CONSTANTS.EDIT)}
                    >
                      <Feather name="edit-2" size={16} color="#0B3D2E" />
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        setDeletePyramidError(null);
                        setPyramidToDelete(pyramid);
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
        onPress={handleOpenCreatePyramid}
        className="absolute bottom-5 right-5 h-16 w-16 items-center justify-center rounded-full bg-pine shadow-lg active:bg-pine-dark"
        accessibilityLabel={t(FINANCIAL_PYRAMIDS_CONSTANTS.NEW_TITLE)}
      >
        <Ionicons name="add" size={32} color="#FFFFFF" />
      </Pressable>

      {/* Create / Edit Financial Pyramid Modal */}
      <Modal
        visible={isPyramidModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsPyramidModalOpen(false)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="max-h-[90%] rounded-t-3xl bg-[#F4FAF6] px-5 pt-5 pb-8">
            <View className="flex-row items-center justify-between pb-3 border-b border-[#DCECE3]">
              <View>
                <Text className="text-[11px] font-extrabold uppercase tracking-wider text-sage">
                  budget.tfinancial_pyramid
                </Text>
                <Text className="text-xl font-extrabold text-pine">
                  {editingPyramid
                    ? t(FINANCIAL_PYRAMIDS_CONSTANTS.EDIT_TITLE)
                    : t(FINANCIAL_PYRAMIDS_CONSTANTS.NEW_TITLE)}
                </Text>
              </View>
              <Pressable
                onPress={() => setIsPyramidModalOpen(false)}
                className="h-9 w-9 items-center justify-center rounded-full bg-[#E2EFE8]"
              >
                <Ionicons name="close" size={20} color="#0B3D2E" />
              </Pressable>
            </View>

            <ScrollView className="mt-4" contentContainerClassName="gap-3.5 pb-4">
              {/* Business Type Dropdown (budget.tbusiness_type) */}
              <View>
                <Text className="mb-1 text-xs font-bold text-[#3B4F46]">
                  {t(FINANCIAL_PYRAMIDS_CONSTANTS.BUSINESS_TYPE_LABEL)} *
                </Text>
                <Pressable
                  onPress={() => setIsBusinessTypeDropdownOpen((prev) => !prev)}
                  className="flex-row items-center justify-between rounded-xl bg-white px-3.5 py-3 border border-[#DCECE3]"
                >
                  <Text className="text-sm font-bold text-[#12211B]">
                    {selectedModalBusinessType
                      ? `${selectedModalBusinessType.name} (${selectedModalBusinessType.code})`
                      : t(COMMON_CONSTANTS.NONE)}
                  </Text>
                  <Ionicons
                    name={isBusinessTypeDropdownOpen ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color="#0B3D2E"
                  />
                </Pressable>

                {isBusinessTypeDropdownOpen ? (
                  <View className="mt-1.5 rounded-xl bg-white p-1.5 border border-[#DCECE3]">
                    {businessTypes.map((bt) => {
                      const selected = businessTypeId === bt.id;
                      return (
                        <Pressable
                          key={bt.id}
                          onPress={() => {
                            setBusinessTypeId(bt.id);
                            setIsBusinessTypeDropdownOpen(false);
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

              <View>
                <Text className="mb-1 text-xs font-bold text-[#3B4F46]">
                  {t(COMMON_CONSTANTS.CODE)} (code) *
                </Text>
                <TextInput
                  value={code}
                  onChangeText={setCode}
                  autoCapitalize="none"
                  placeholder="standard_50_30_20"
                  placeholderTextColor="#8FA198"
                  className="rounded-xl bg-white px-3.5 py-2.5 text-sm text-[#12211B] border border-[#DCECE3]"
                />
              </View>

              <View>
                <Text className="mb-1 text-xs font-bold text-[#3B4F46]">
                  {t(COMMON_CONSTANTS.NAME)} (name) *
                </Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="50/30/20 Rule"
                  placeholderTextColor="#8FA198"
                  className="rounded-xl bg-white px-3.5 py-2.5 text-sm text-[#12211B] border border-[#DCECE3]"
                />
              </View>

              <View>
                <Text className="mb-1 text-xs font-bold text-[#3B4F46]">
                  {t(COMMON_CONSTANTS.DESCRIPTION)} (description)
                </Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={2}
                  placeholder="Recommended distribution..."
                  placeholderTextColor="#8FA198"
                  className="rounded-xl bg-white px-3.5 py-2.5 text-sm text-[#12211B] border border-[#DCECE3]"
                />
              </View>

              {pyramidFormError ? (
                <View className="rounded-2xl bg-red-50 p-3 border border-red-200">
                  <Text className="text-xs font-bold text-red-700">{pyramidFormError}</Text>
                </View>
              ) : null}

              <Pressable
                onPress={() => void handleSavePyramid()}
                disabled={savingPyramid}
                className="mt-2 flex-row items-center justify-center rounded-2xl bg-pine py-4 shadow-md active:opacity-90 disabled:opacity-50"
              >
                {savingPyramid ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
                    <Text className="ml-2 text-sm font-extrabold text-white">
                      {editingPyramid
                        ? t(COMMON_CONSTANTS.SAVE_CHANGES)
                        : t(FINANCIAL_PYRAMIDS_CONSTANTS.CREATE_BTN)}
                    </Text>
                  </>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Confirm Logical Delete Pyramid Modal */}
      <Modal
        visible={Boolean(pyramidToDelete)}
        animationType="fade"
        transparent
        onRequestClose={() => setPyramidToDelete(null)}
      >
        <View className="flex-1 items-center justify-center bg-black/40 px-5">
          <View className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-[#FFF5F5] self-center">
              <Feather name="trash-2" size={22} color="#C53030" />
            </View>
            <Text className="mt-3 text-center text-lg font-extrabold text-[#12211B]">
              {t(FINANCIAL_PYRAMIDS_CONSTANTS.DELETE_TITLE)}
            </Text>
            <Text className="mt-1.5 text-center text-[13px] text-[#5A6D64]">
              {t(COMMON_CONSTANTS.LOGICAL_DELETE_DESC, {
                name: pyramidToDelete?.name || pyramidToDelete?.code || '',
              })}
            </Text>

            {deletePyramidError ? (
              <View className="mt-3 rounded-xl bg-red-50 p-3">
                <Text className="text-xs font-bold text-red-700">{deletePyramidError}</Text>
              </View>
            ) : null}

            <View className="mt-5 flex-row gap-2.5">
              <Pressable
                onPress={() => setPyramidToDelete(null)}
                disabled={deletingPyramid}
                className="flex-1 items-center justify-center rounded-2xl bg-[#E8F4ED] py-3"
              >
                <Text className="text-xs font-extrabold text-pine">
                  {t(COMMON_CONSTANTS.CANCEL)}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => void handleConfirmDeletePyramid()}
                disabled={deletingPyramid}
                className="flex-1 items-center justify-center rounded-2xl bg-[#C53030] py-3"
              >
                {deletingPyramid ? (
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

