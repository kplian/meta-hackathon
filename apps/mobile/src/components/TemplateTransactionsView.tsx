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
import { COMMON_CONSTANTS, TEMPLATE_TRANSACTIONS_CONSTANTS } from '../i18n/constants';
import type {
  AccountRow,
  BusinessTypeRow,
  TemplateTransactionDetRow,
  TemplateTransactionRow,
} from '../lib/budget-schema';

interface TemplateTransactionsViewProps {
  currentUserId: string;
}

const SIDE_OPTIONS = ['debit', 'credit'] as const;

export default function TemplateTransactionsView({
  currentUserId,
}: TemplateTransactionsViewProps) {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<TemplateTransactionRow[]>([]);
  const [businessTypes, setBusinessTypes] = useState<BusinessTypeRow[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [detailCounts, setDetailCounts] = useState<Record<string, number>>({});
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Create / Edit Template modal state (no household_id)
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateTransactionRow | null>(null);
  const [businessTypeId, setBusinessTypeId] = useState<string>('');
  const [isBusinessTypeDropdownOpen, setIsBusinessTypeDropdownOpen] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [version, setVersion] = useState('1');
  const [description, setDescription] = useState('');
  const [inputSchemaText, setInputSchemaText] = useState('{}');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateFormError, setTemplateFormError] = useState<string | null>(null);

  // Logical Delete Template confirmation modal state
  const [templateToDelete, setTemplateToDelete] = useState<TemplateTransactionRow | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState(false);
  const [deleteTemplateError, setDeleteTemplateError] = useState<string | null>(null);

  // Details Sub-View state (budget.ttemplate_transaction_det)
  const [selectedTemplateForDetails, setSelectedTemplateForDetails] =
    useState<TemplateTransactionRow | null>(null);
  const [details, setDetails] = useState<TemplateTransactionDetRow[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailSearchQuery, setDetailSearchQuery] = useState('');

  // Create / Edit Detail modal state
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [editingDetail, setEditingDetail] = useState<TemplateTransactionDetRow | null>(null);
  const [lineNumber, setLineNumber] = useState('1');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const [side, setSide] = useState<'debit' | 'credit'>('debit');
  const [amountRuleText, setAmountRuleText] = useState('{"var": "amount"}');
  const [descriptionTemplate, setDescriptionTemplate] = useState('');
  const [accountInputKey, setAccountInputKey] = useState('');
  const [auxiliarInputKey, setAuxiliarInputKey] = useState('');
  const [itemInputKey, setItemInputKey] = useState('');
  const [repeatInputKey, setRepeatInputKey] = useState('');
  const [quantityInputKey, setQuantityInputKey] = useState('');
  const [unitPriceInputKey, setUnitPriceInputKey] = useState('');
  const [unitInputKey, setUnitInputKey] = useState('');
  const [savingDetail, setSavingDetail] = useState(false);
  const [detailFormError, setDetailFormError] = useState<string | null>(null);

  // Logical Delete Detail confirmation modal state
  const [detailToDelete, setDetailToDelete] = useState<TemplateTransactionDetRow | null>(null);
  const [deletingDetail, setDeletingDetail] = useState(false);
  const [deleteDetailError, setDeleteDetailError] = useState<string | null>(null);

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

  // Load active non-deleted templates, business types, accounts, and detail counts
  const loadTemplatesData = async () => {
    setLoadingTemplates(true);
    try {
      const [tplRes, bizRes, accRes, detRes] = await Promise.all([
        supabase
          .schema('budget')
          .from('ttemplate_transaction')
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
          .from('taccount')
          .select('*')
          .is('deleted_at', null)
          .is('household_id', null)
          .order('code', { ascending: true }),
        supabase
          .schema('budget')
          .from('ttemplate_transaction_det')
          .select('id, template_transaction_id')
          .is('deleted_at', null),
      ]);

      setTemplates(tplRes.data ?? []);
      setBusinessTypes(bizRes.data ?? []);
      setAccounts(accRes.data ?? []);

      if (detRes.data) {
        const counts: Record<string, number> = {};
        for (const d of detRes.data) {
          counts[d.template_transaction_id] = (counts[d.template_transaction_id] ?? 0) + 1;
        }
        setDetailCounts(counts);
      }
    } finally {
      setLoadingTemplates(false);
    }
  };

  // Load active non-deleted detail lines for a specific template
  const loadTemplateDetails = async (templateId: string) => {
    setLoadingDetails(true);
    try {
      const { data } = await supabase
        .schema('budget')
        .from('ttemplate_transaction_det')
        .select('*')
        .eq('template_transaction_id', templateId)
        .is('deleted_at', null)
        .order('line_number', { ascending: true });

      const list = data ?? [];
      setDetails(list);
      setDetailCounts((prev) => ({
        ...prev,
        [templateId]: list.length,
      }));
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    void loadTemplatesData();
  }, []);

  useEffect(() => {
    if (selectedTemplateForDetails) {
      void loadTemplateDetails(selectedTemplateForDetails.id);
    }
  }, [selectedTemplateForDetails?.id]);

  const businessTypeMap = useMemo(
    () => new Map(businessTypes.map((b) => [b.id, b])),
    [businessTypes],
  );
  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts],
  );

  // Filtered templates (excluding any household-specific templates)
  const filteredTemplates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    // Exclude records where household_id is not null
    const baseTemplates = templates.filter(
      (t) => t.household_id === null || t.household_id === undefined,
    );
    if (!q) return baseTemplates;
    return baseTemplates.filter((t) => {
      const bizName =
        (t.business_type_id && businessTypeMap.get(t.business_type_id)?.name) || '';
      return (
        t.name.toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q) ||
        (t.description ?? '').toLowerCase().includes(q) ||
        bizName.toLowerCase().includes(q)
      );
    });
  }, [templates, searchQuery, businessTypeMap]);

  // Filtered detail lines
  const filteredDetails = useMemo(() => {
    const q = detailSearchQuery.trim().toLowerCase();
    if (!q) return details;
    return details.filter((d) => {
      const acc = d.account_id ? accountMap.get(d.account_id) : undefined;
      const accLabel = acc ? `${acc.code} ${acc.name}` : '';
      return (
        d.side.toLowerCase().includes(q) ||
        (d.description_template ?? '').toLowerCase().includes(q) ||
        accLabel.toLowerCase().includes(q)
      );
    });
  }, [details, detailSearchQuery, accountMap]);

  // Open Create Template modal
  const handleOpenCreateTemplate = () => {
    setEditingTemplate(null);
    setBusinessTypeId(businessTypes[0]?.id ?? '');
    setIsBusinessTypeDropdownOpen(false);
    setCode('');
    setName('');
    setVersion('1');
    setDescription('');
    setInputSchemaText('{}');
    setTemplateFormError(null);
    setIsTemplateModalOpen(true);
  };

  // Open Edit Template modal
  const handleOpenEditTemplate = (tpl: TemplateTransactionRow) => {
    setEditingTemplate(tpl);
    setBusinessTypeId(tpl.business_type_id ?? businessTypes[0]?.id ?? '');
    setIsBusinessTypeDropdownOpen(false);
    setCode(tpl.code);
    setName(tpl.name);
    setVersion(String(tpl.version ?? 1));
    setDescription(tpl.description ?? '');
    setInputSchemaText(
      typeof tpl.input_schema === 'string'
        ? tpl.input_schema
        : JSON.stringify(tpl.input_schema ?? {}),
    );
    setTemplateFormError(null);
    setIsTemplateModalOpen(true);
  };

  // Save Template (Create or Update without household_id)
  const handleSaveTemplate = async () => {
    setTemplateFormError(null);
    if (!businessTypeId) {
      setTemplateFormError('Selecciona un Business Type del desplegable.');
      return;
    }
    if (!code.trim()) {
      setTemplateFormError('El código es obligatorio (ej. purchase, sale).');
      return;
    }
    if (!name.trim()) {
      setTemplateFormError('El nombre de la plantilla es obligatorio.');
      return;
    }

    let parsedSchema: Record<string, unknown> = {};
    try {
      parsedSchema = JSON.parse(inputSchemaText.trim() || '{}') as Record<string, unknown>;
    } catch {
      setTemplateFormError('El campo input_schema debe ser un JSON válido (ej. {}).');
      return;
    }

    const parsedVersion = parseInt(version, 10) || 1;

    setSavingTemplate(true);
    try {
      const actorId = await resolveActorUserId();

      if (editingTemplate) {
        const { error } = await supabase
          .schema('budget')
          .from('ttemplate_transaction')
          .update({
            business_type_id: businessTypeId,
            code: code.trim().toLowerCase(),
            name: name.trim(),
            version: parsedVersion,
            description: description.trim() || null,
            input_schema: parsedSchema as never,
            updated_at: new Date().toISOString(),
            updated_by: actorId,
          })
          .eq('id', editingTemplate.id);

        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .schema('budget')
          .from('ttemplate_transaction')
          .insert({
            business_type_id: businessTypeId,
            code: code.trim().toLowerCase(),
            name: name.trim(),
            version: parsedVersion,
            description: description.trim() || null,
            input_schema: parsedSchema as never,
            status: 'active',
            created_by: actorId,
          });

        if (error) throw new Error(error.message);
      }

      setIsTemplateModalOpen(false);
      await loadTemplatesData();
    } catch (err) {
      setTemplateFormError(
        err instanceof Error ? err.message : 'Error al guardar la plantilla de transacción',
      );
    } finally {
      setSavingTemplate(false);
    }
  };

  // Confirm logical deletion of Template
  const handleConfirmDeleteTemplate = async () => {
    if (!templateToDelete) return;
    setDeletingTemplate(true);
    setDeleteTemplateError(null);
    try {
      const actorId = await resolveActorUserId();
      const { error } = await supabase
        .schema('budget')
        .from('ttemplate_transaction')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: actorId,
          status: 'inactive',
        })
        .eq('id', templateToDelete.id);

      if (error) throw new Error(error.message);

      setTemplateToDelete(null);
      await loadTemplatesData();
    } catch (err) {
      setDeleteTemplateError(
        err instanceof Error ? err.message : 'No se pudo eliminar la plantilla',
      );
    } finally {
      setDeletingTemplate(false);
    }
  };

  // Open Create Detail modal
  const handleOpenCreateDetail = () => {
    setEditingDetail(null);
    setLineNumber(String(details.length + 1));
    setAccountId(accounts[0]?.id ?? null);
    setIsAccountDropdownOpen(false);
    setSide(details.length % 2 === 0 ? 'debit' : 'credit');
    setAmountRuleText('{"var": "amount"}');
    setDescriptionTemplate(details.length % 2 === 0 ? 'Debit record' : 'Credit record');
    setAccountInputKey('');
    setAuxiliarInputKey('');
    setItemInputKey('');
    setRepeatInputKey('');
    setQuantityInputKey('');
    setUnitPriceInputKey('');
    setUnitInputKey('');
    setDetailFormError(null);
    setIsDetailModalOpen(true);
  };

  // Open Edit Detail modal
  const handleOpenEditDetail = (det: TemplateTransactionDetRow) => {
    setEditingDetail(det);
    setLineNumber(String(det.line_number ?? 1));
    setAccountId(det.account_id ?? null);
    setIsAccountDropdownOpen(false);
    setSide(det.side === 'credit' ? 'credit' : 'debit');
    setAmountRuleText(
      typeof det.amount_rule === 'string'
        ? det.amount_rule
        : JSON.stringify(det.amount_rule ?? { var: 'amount' }),
    );
    setDescriptionTemplate(det.description_template ?? '');
    setAccountInputKey(det.account_input_key ?? '');
    setAuxiliarInputKey(det.auxiliar_input_key ?? '');
    setItemInputKey(det.item_input_key ?? '');
    setRepeatInputKey(det.repeat_input_key ?? '');
    setQuantityInputKey(det.quantity_input_key ?? '');
    setUnitPriceInputKey(det.unit_price_input_key ?? '');
    setUnitInputKey(det.unit_input_key ?? '');
    setDetailFormError(null);
    setIsDetailModalOpen(true);
  };

  // Save Detail Line (Create or Update in budget.ttemplate_transaction_det)
  const handleSaveDetail = async () => {
    if (!selectedTemplateForDetails) return;
    setDetailFormError(null);

    const parsedLineNumber = parseInt(lineNumber, 10);
    if (Number.isNaN(parsedLineNumber) || parsedLineNumber <= 0) {
      setDetailFormError('El número de línea (line_number) debe ser mayor a 0.');
      return;
    }

    let parsedRule: Record<string, unknown> = {};
    try {
      parsedRule = JSON.parse(amountRuleText.trim() || '{}') as Record<string, unknown>;
    } catch {
      setDetailFormError('El campo amount_rule debe ser un JSON válido (ej. {"var": "amount"}).');
      return;
    }

    setSavingDetail(true);
    try {
      const actorId = await resolveActorUserId();

      if (editingDetail) {
        const { error } = await supabase
          .schema('budget')
          .from('ttemplate_transaction_det')
          .update({
            line_number: parsedLineNumber,
            account_id: accountId || null,
            side,
            amount_rule: parsedRule as never,
            description_template: descriptionTemplate.trim() || null,
            account_input_key: accountInputKey.trim(),
            auxiliar_input_key: auxiliarInputKey.trim() || null,
            item_input_key: itemInputKey.trim(),
            repeat_input_key: repeatInputKey.trim(),
            quantity_input_key: quantityInputKey.trim(),
            unit_price_input_key: unitPriceInputKey.trim(),
            unit_input_key: unitInputKey.trim(),
            updated_at: new Date().toISOString(),
            updated_by: actorId,
          })
          .eq('id', editingDetail.id);

        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .schema('budget')
          .from('ttemplate_transaction_det')
          .insert({
            template_transaction_id: selectedTemplateForDetails.id,
            line_number: parsedLineNumber,
            account_id: accountId || null,
            side,
            amount_rule: parsedRule as never,
            description_template: descriptionTemplate.trim() || null,
            account_input_key: accountInputKey.trim(),
            auxiliar_input_key: auxiliarInputKey.trim() || null,
            item_input_key: itemInputKey.trim(),
            repeat_input_key: repeatInputKey.trim(),
            quantity_input_key: quantityInputKey.trim(),
            unit_price_input_key: unitPriceInputKey.trim(),
            unit_input_key: unitInputKey.trim(),
            status: 'active',
            created_by: actorId,
          });

        if (error) throw new Error(error.message);
      }

      setIsDetailModalOpen(false);
      await loadTemplateDetails(selectedTemplateForDetails.id);
    } catch (err) {
      setDetailFormError(
        err instanceof Error ? err.message : 'Error al guardar el detalle de la plantilla',
      );
    } finally {
      setSavingDetail(false);
    }
  };

  // Confirm logical deletion of Detail Line
  const handleConfirmDeleteDetail = async () => {
    if (!detailToDelete || !selectedTemplateForDetails) return;
    setDeletingDetail(true);
    setDeleteDetailError(null);
    try {
      const actorId = await resolveActorUserId();
      const { error } = await supabase
        .schema('budget')
        .from('ttemplate_transaction_det')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: actorId,
          status: 'inactive',
        })
        .eq('id', detailToDelete.id);

      if (error) throw new Error(error.message);

      setDetailToDelete(null);
      await loadTemplateDetails(selectedTemplateForDetails.id);
    } catch (err) {
      setDeleteDetailError(
        err instanceof Error ? err.message : 'No se pudo eliminar el detalle',
      );
    } finally {
      setDeletingDetail(false);
    }
  };

  const selectedModalBusinessType = businessTypeMap.get(businessTypeId);
  const selectedModalAccount = accountId ? accountMap.get(accountId) : null;

  // ============================================================================
  // TEMPLATE DETAILS SUB-INTERFACE (budget.ttemplate_transaction_det)
  // ============================================================================
  if (selectedTemplateForDetails) {
    const parentBizType = selectedTemplateForDetails.business_type_id
      ? businessTypeMap.get(selectedTemplateForDetails.business_type_id)
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
                setSelectedTemplateForDetails(null);
                setDetailSearchQuery('');
              }}
              className="flex-row items-center rounded-full bg-[#DCECE3] px-3.5 py-2 active:bg-[#CBE2D5]"
            >
              <Ionicons name="arrow-back" size={16} color="#0B3D2E" />
              <Text className="ml-1.5 text-[13px] font-bold text-pine">
                {t(TEMPLATE_TRANSACTIONS_CONSTANTS.BACK_TO_TEMPLATES)}
              </Text>
            </Pressable>

            <View className="rounded-full bg-[#E6F4EC] px-3 py-1">
              <Text className="text-[11px] font-extrabold text-pine">
                budget.ttemplate_transaction_det • {details.length}{' '}
                {details.length === 1
                  ? t(TEMPLATE_TRANSACTIONS_CONSTANTS.LINE_SINGULAR)
                  : t(TEMPLATE_TRANSACTIONS_CONSTANTS.LINE_PLURAL)}
              </Text>
            </View>
          </View>

          {/* Selected Template Banner */}
          <View className="mb-4 rounded-3xl bg-white p-4 shadow-sm border border-[#E5F0EA] flex-row items-center justify-between">
            <View className="flex-row items-center flex-1">
              <View className="h-11 w-11 items-center justify-center rounded-full bg-pine">
                <MaterialCommunityIcons
                  name="file-document-edit-outline"
                  size={20}
                  color="#FFFFFF"
                />
              </View>
              <View className="ml-3 flex-1">
                <View className="flex-row items-center flex-wrap gap-1.5">
                  <Text className="text-[11px] font-extrabold uppercase tracking-wider text-[#5A6D64]">
                    {t(TEMPLATE_TRANSACTIONS_CONSTANTS.DETAILS_HEADER)}
                  </Text>
                  <View className="rounded-full bg-[#DFF5E8] px-2 py-0.5">
                    <Text className="text-[10px] font-extrabold text-[#0B3D2E]">
                      v{selectedTemplateForDetails.version}
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
                  {selectedTemplateForDetails.name} ({selectedTemplateForDetails.code})
                </Text>
                <Text className="text-[12px] text-[#5A6D64]" numberOfLines={1}>
                  {selectedTemplateForDetails.description || selectedTemplateForDetails.code}
                </Text>
              </View>
            </View>
          </View>

          {/* Search Input + Refresh */}
          <View className="flex-row items-center gap-2.5 mb-4">
            <View className="flex-1 flex-row items-center rounded-2xl bg-white px-4 py-3 shadow-sm border border-[#E5F0EA]">
              <Ionicons name="search-outline" size={20} color="#7A8C83" />
              <TextInput
                value={detailSearchQuery}
                onChangeText={setDetailSearchQuery}
                placeholder={t(TEMPLATE_TRANSACTIONS_CONSTANTS.SEARCH_DETAIL_PLACEHOLDER)}
                placeholderTextColor="#7A8C83"
                className="ml-2.5 flex-1 text-[15px] text-pine"
              />
              {detailSearchQuery ? (
                <Pressable onPress={() => setDetailSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color="#9BA8A2" />
                </Pressable>
              ) : null}
            </View>

            <Pressable
              onPress={() => void loadTemplateDetails(selectedTemplateForDetails.id)}
              className="h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm border border-[#E5F0EA] active:bg-[#E8F4ED]"
              accessibilityLabel={t(COMMON_CONSTANTS.REFRESH)}
            >
              <Ionicons name="refresh" size={20} color="#0B3D2E" />
            </Pressable>
          </View>

          {/* Template Detail Cards List */}
          {loadingDetails ? (
            <View className="py-10 items-center">
              <ActivityIndicator size="large" color="#0B3D2E" />
            </View>
          ) : filteredDetails.length === 0 ? (
            <View className="mt-2 items-center rounded-3xl bg-white p-8 shadow-sm border border-[#E5F0EA]">
              <Ionicons name="list-outline" size={36} color="#9BA8A2" />
              <Text className="mt-3 text-[15px] font-bold text-[#12211B]">
                {t(TEMPLATE_TRANSACTIONS_CONSTANTS.EMPTY_DETAILS_TITLE)}
              </Text>
              <Text className="mt-1 text-center text-[13px] text-[#5A6D64]">
                {t(TEMPLATE_TRANSACTIONS_CONSTANTS.EMPTY_DETAILS_DESC, {
                  name: selectedTemplateForDetails.name,
                })}
              </Text>
            </View>
          ) : (
            <View className="gap-2.5">
              {filteredDetails.map((det) => {
                const isDebit = det.side === 'debit';
                const acc = det.account_id ? accountMap.get(det.account_id) : undefined;
                const badgeStyle = isDebit
                  ? 'bg-[#DFF5E8] text-[#0B3D2E]'
                  : 'bg-[#FDE6D5] text-[#8E3B10]';
                const ruleStr =
                  typeof det.amount_rule === 'string'
                    ? det.amount_rule
                    : JSON.stringify(det.amount_rule ?? {});

                return (
                  <View
                    key={det.id}
                    className="flex-row items-center justify-between rounded-3xl bg-white px-4 py-3.5 shadow-sm border border-[#E7F1EC]"
                  >
                    {/* Left Line Number Badge + Detail Info */}
                    <View className="flex-row items-center flex-1 mr-2">
                      <View
                        className="h-12 w-12 items-center justify-center rounded-full"
                        style={{ backgroundColor: isDebit ? '#E6F4EC' : '#FFF1E6' }}
                      >
                        <Text
                          className="text-[14px] font-extrabold"
                          style={{ color: isDebit ? '#0B3D2E' : '#9A4B1A' }}
                        >
                          #{det.line_number}
                        </Text>
                      </View>

                      <View className="ml-3 flex-1">
                        <View className="flex-row items-center flex-wrap gap-1.5">
                          <Text
                            className="text-[15px] font-extrabold text-[#12211B]"
                            numberOfLines={1}
                          >
                            {acc
                              ? `${acc.code} — ${acc.name}`
                              : det.account_input_key
                                ? `Key: ${det.account_input_key}`
                                : t(TEMPLATE_TRANSACTIONS_CONSTANTS.NO_FIXED_ACCOUNT)}
                          </Text>

                          <View className={`rounded-full px-2.5 py-0.5 ${badgeStyle}`}>
                            <Text className="text-[10px] font-extrabold uppercase">
                              {det.side}
                            </Text>
                          </View>

                          <View className="rounded-full bg-[#E3ECE7] px-2.5 py-0.5">
                            <Text className="text-[10px] font-bold text-[#3B4F46]">
                              {ruleStr}
                            </Text>
                          </View>
                        </View>

                        <View className="mt-1 flex-row items-center">
                          <View className="h-4 w-4 items-center justify-center rounded-full bg-[#D9EBE0]">
                            <Text className="text-[8px] font-extrabold text-pine">
                              {isDebit ? 'D' : 'C'}
                            </Text>
                          </View>
                          <Text
                            className="ml-1.5 text-[12px] font-medium text-[#5A6D64] flex-1"
                            numberOfLines={1}
                          >
                            {det.description_template || `#${det.line_number}`}
                            {det.auxiliar_input_key ? ` • AuxKey: ${det.auxiliar_input_key}` : ''}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Right Flat Action Icons: Edit & Delete */}
                    <View className="flex-row items-center gap-1.5">
                      <Pressable
                        onPress={() => handleOpenEditDetail(det)}
                        className="h-9 w-9 items-center justify-center rounded-full bg-[#F2F8F4] active:bg-[#DCECE3]"
                        accessibilityLabel={t(COMMON_CONSTANTS.EDIT)}
                      >
                        <Feather name="edit-2" size={16} color="#0B3D2E" />
                      </Pressable>

                      <Pressable
                        onPress={() => {
                          setDeleteDetailError(null);
                          setDetailToDelete(det);
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

        {/* Fixed Floating Action Button (+) for New Detail Line */}
        <Pressable
          onPress={handleOpenCreateDetail}
          className="absolute bottom-5 right-5 h-16 w-16 items-center justify-center rounded-full bg-pine shadow-lg active:bg-pine-dark"
          accessibilityLabel={t(TEMPLATE_TRANSACTIONS_CONSTANTS.NEW_DETAIL_TITLE)}
        >
          <Ionicons name="add" size={32} color="#FFFFFF" />
        </Pressable>

        {/* Create / Edit Detail Modal */}
        <Modal
          visible={isDetailModalOpen}
          animationType="slide"
          transparent
          onRequestClose={() => setIsDetailModalOpen(false)}
        >
          <View className="flex-1 justify-end bg-black/40">
            <View className="max-h-[92%] rounded-t-3xl bg-[#F4FAF6] px-5 pt-5 pb-8">
              <View className="flex-row items-center justify-between pb-3 border-b border-[#DCECE3]">
                <View>
                  <Text className="text-[11px] font-extrabold uppercase tracking-wider text-sage">
                    budget.ttemplate_transaction_det • {selectedTemplateForDetails.name}
                  </Text>
                  <Text className="text-xl font-extrabold text-pine">
                    {editingDetail
                      ? t(TEMPLATE_TRANSACTIONS_CONSTANTS.EDIT_DETAIL_TITLE)
                      : t(TEMPLATE_TRANSACTIONS_CONSTANTS.NEW_DETAIL_TITLE)}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setIsDetailModalOpen(false)}
                  className="h-9 w-9 items-center justify-center rounded-full bg-[#E2EFE8]"
                >
                  <Ionicons name="close" size={20} color="#0B3D2E" />
                </Pressable>
              </View>

              <ScrollView className="mt-4" contentContainerClassName="gap-3.5 pb-6">
                {/* Line Number & Side (Debit / Credit) */}
                <View className="flex-row gap-2.5">
                  <View className="w-28">
                    <Text className="mb-1 text-xs font-bold text-[#3B4F46]">
                      {t(TEMPLATE_TRANSACTIONS_CONSTANTS.LINE_NUMBER_LABEL)} *
                    </Text>
                    <TextInput
                      value={lineNumber}
                      onChangeText={setLineNumber}
                      keyboardType="numeric"
                      placeholder="1"
                      placeholderTextColor="#8FA198"
                      className="rounded-xl bg-white px-3.5 py-2.5 text-sm text-[#12211B] border border-[#DCECE3]"
                    />
                  </View>

                  <View className="flex-1">
                    <Text className="mb-1 text-xs font-bold text-[#3B4F46]">
                      {t(TEMPLATE_TRANSACTIONS_CONSTANTS.SIDE_LABEL)} *
                    </Text>
                    <View className="flex-row gap-2">
                      {SIDE_OPTIONS.map((opt) => {
                        const active = side === opt;
                        return (
                          <Pressable
                            key={opt}
                            onPress={() => setSide(opt)}
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
                </View>

                {/* Account FK Dropdown (budget.taccount) */}
                <View>
                  <Text className="mb-1 text-xs font-bold text-[#3B4F46]">
                    {t(TEMPLATE_TRANSACTIONS_CONSTANTS.ACCOUNT_FK_LABEL)}
                  </Text>
                  <Pressable
                    onPress={() => setIsAccountDropdownOpen((prev) => !prev)}
                    className="flex-row items-center justify-between rounded-xl bg-white px-3.5 py-3 border border-[#DCECE3]"
                  >
                    <Text className="text-sm font-bold text-[#12211B]">
                      {selectedModalAccount
                        ? `${selectedModalAccount.code} — ${selectedModalAccount.name}`
                        : t(COMMON_CONSTANTS.NONE)}
                    </Text>
                    <Ionicons
                      name={isAccountDropdownOpen ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color="#0B3D2E"
                    />
                  </Pressable>

                  {isAccountDropdownOpen ? (
                    <View className="mt-1.5 max-h-48 rounded-xl bg-white p-1.5 border border-[#DCECE3]">
                      <ScrollView nestedScrollEnabled>
                        <Pressable
                          onPress={() => {
                            setAccountId(null);
                            setIsAccountDropdownOpen(false);
                          }}
                          className={`flex-row items-center justify-between rounded-lg px-3 py-2 ${
                            accountId === null ? 'bg-[#E6F4EC]' : 'bg-transparent'
                          }`}
                        >
                          <Text className="text-xs font-bold text-pine">
                            {t(COMMON_CONSTANTS.NONE)}
                          </Text>
                          {accountId === null ? (
                            <Ionicons name="checkmark-circle" size={16} color="#0B3D2E" />
                          ) : null}
                        </Pressable>

                        {accounts.map((acc) => {
                          const selected = accountId === acc.id;
                          return (
                            <Pressable
                              key={acc.id}
                              onPress={() => {
                                setAccountId(acc.id);
                                setIsAccountDropdownOpen(false);
                              }}
                              className={`flex-row items-center justify-between rounded-lg px-3 py-2 ${
                                selected ? 'bg-[#E6F4EC]' : 'bg-transparent'
                              }`}
                            >
                              <Text className="text-xs font-bold text-[#12211B]">
                                {acc.code} — {acc.name} ({acc.currency?.trim() || 'BOB'})
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

                {/* Amount Rule JSONB & Description Template */}
                <View>
                  <Text className="mb-1 text-xs font-bold text-[#3B4F46]">
                    {t(TEMPLATE_TRANSACTIONS_CONSTANTS.AMOUNT_RULE_LABEL)} *
                  </Text>
                  <TextInput
                    value={amountRuleText}
                    onChangeText={setAmountRuleText}
                    autoCapitalize="none"
                    placeholder='{"var": "amount"}'
                    placeholderTextColor="#8FA198"
                    className="rounded-xl bg-white px-3.5 py-2.5 text-sm text-[#12211B] border border-[#DCECE3]"
                  />
                </View>

                <View>
                  <Text className="mb-1 text-xs font-bold text-[#3B4F46]">
                    {t(TEMPLATE_TRANSACTIONS_CONSTANTS.DESCRIPTION_TEMPLATE_LABEL)}
                  </Text>
                  <TextInput
                    value={descriptionTemplate}
                    onChangeText={setDescriptionTemplate}
                    placeholder="Debit record / Credit record"
                    placeholderTextColor="#8FA198"
                    className="rounded-xl bg-white px-3.5 py-2.5 text-sm text-[#12211B] border border-[#DCECE3]"
                  />
                </View>

                {/* Optional Dynamic Input Keys */}
                <View className="flex-row gap-2.5">
                  <View className="flex-1">
                    <Text className="mb-1 text-xs font-bold text-[#3B4F46]">
                      account_input_key
                    </Text>
                    <TextInput
                      value={accountInputKey}
                      onChangeText={setAccountInputKey}
                      autoCapitalize="none"
                      placeholder={t(COMMON_CONSTANTS.OPTIONAL)}
                      placeholderTextColor="#8FA198"
                      className="rounded-xl bg-white px-3.5 py-2 text-xs text-[#12211B] border border-[#DCECE3]"
                    />
                  </View>

                  <View className="flex-1">
                    <Text className="mb-1 text-xs font-bold text-[#3B4F46]">
                      auxiliar_input_key
                    </Text>
                    <TextInput
                      value={auxiliarInputKey}
                      onChangeText={setAuxiliarInputKey}
                      autoCapitalize="none"
                      placeholder={t(COMMON_CONSTANTS.OPTIONAL)}
                      placeholderTextColor="#8FA198"
                      className="rounded-xl bg-white px-3.5 py-2 text-xs text-[#12211B] border border-[#DCECE3]"
                    />
                  </View>
                </View>

                <View className="flex-row gap-2.5">
                  <View className="flex-1">
                    <Text className="mb-1 text-xs font-bold text-[#3B4F46]">item_input_key</Text>
                    <TextInput
                      value={itemInputKey}
                      onChangeText={setItemInputKey}
                      autoCapitalize="none"
                      placeholder={t(COMMON_CONSTANTS.OPTIONAL)}
                      placeholderTextColor="#8FA198"
                      className="rounded-xl bg-white px-3.5 py-2 text-xs text-[#12211B] border border-[#DCECE3]"
                    />
                  </View>

                  <View className="flex-1">
                    <Text className="mb-1 text-xs font-bold text-[#3B4F46]">repeat_input_key</Text>
                    <TextInput
                      value={repeatInputKey}
                      onChangeText={setRepeatInputKey}
                      autoCapitalize="none"
                      placeholder={t(COMMON_CONSTANTS.OPTIONAL)}
                      placeholderTextColor="#8FA198"
                      className="rounded-xl bg-white px-3.5 py-2 text-xs text-[#12211B] border border-[#DCECE3]"
                    />
                  </View>
                </View>

                <View className="flex-row gap-2.5">
                  <View className="flex-1">
                    <Text className="mb-1 text-xs font-bold text-[#3B4F46]">
                      quantity_input_key
                    </Text>
                    <TextInput
                      value={quantityInputKey}
                      onChangeText={setQuantityInputKey}
                      autoCapitalize="none"
                      placeholder={t(COMMON_CONSTANTS.OPTIONAL)}
                      placeholderTextColor="#8FA198"
                      className="rounded-xl bg-white px-3.5 py-2 text-xs text-[#12211B] border border-[#DCECE3]"
                    />
                  </View>

                  <View className="flex-1">
                    <Text className="mb-1 text-xs font-bold text-[#3B4F46]">
                      unit_price_input_key
                    </Text>
                    <TextInput
                      value={unitPriceInputKey}
                      onChangeText={setUnitPriceInputKey}
                      autoCapitalize="none"
                      placeholder={t(COMMON_CONSTANTS.OPTIONAL)}
                      placeholderTextColor="#8FA198"
                      className="rounded-xl bg-white px-3.5 py-2 text-xs text-[#12211B] border border-[#DCECE3]"
                    />
                  </View>

                  <View className="flex-1">
                    <Text className="mb-1 text-xs font-bold text-[#3B4F46]">unit_input_key</Text>
                    <TextInput
                      value={unitInputKey}
                      onChangeText={setUnitInputKey}
                      autoCapitalize="none"
                      placeholder={t(COMMON_CONSTANTS.OPTIONAL)}
                      placeholderTextColor="#8FA198"
                      className="rounded-xl bg-white px-3.5 py-2 text-xs text-[#12211B] border border-[#DCECE3]"
                    />
                  </View>
                </View>

                {detailFormError ? (
                  <View className="rounded-2xl bg-red-50 p-3 border border-red-200">
                    <Text className="text-xs font-bold text-red-700">{detailFormError}</Text>
                  </View>
                ) : null}

                <Pressable
                  onPress={() => void handleSaveDetail()}
                  disabled={savingDetail}
                  className="mt-2 flex-row items-center justify-center rounded-2xl bg-pine py-4 shadow-md active:opacity-90 disabled:opacity-50"
                >
                  {savingDetail ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
                      <Text className="ml-2 text-sm font-extrabold text-white">
                        {editingDetail
                          ? t(COMMON_CONSTANTS.SAVE_CHANGES)
                          : t(TEMPLATE_TRANSACTIONS_CONSTANTS.CREATE_DETAIL_BTN)}
                      </Text>
                    </>
                  )}
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Confirm Logical Delete Detail Modal */}
        <Modal
          visible={Boolean(detailToDelete)}
          animationType="fade"
          transparent
          onRequestClose={() => setDetailToDelete(null)}
        >
          <View className="flex-1 items-center justify-center bg-black/40 px-5">
            <View className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
              <View className="h-12 w-12 items-center justify-center rounded-full bg-[#FFF5F5] self-center">
                <Feather name="trash-2" size={22} color="#C53030" />
              </View>
              <Text className="mt-3 text-center text-lg font-extrabold text-[#12211B]">
                {t(TEMPLATE_TRANSACTIONS_CONSTANTS.DELETE_DETAIL_TITLE)}
              </Text>
              <Text className="mt-1.5 text-center text-[13px] text-[#5A6D64]">
                {t(COMMON_CONSTANTS.LOGICAL_DELETE_DESC, {
                  name: `#${detailToDelete?.line_number ?? ''} (${detailToDelete?.side ?? ''})`,
                })}
              </Text>

              {deleteDetailError ? (
                <View className="mt-3 rounded-xl bg-red-50 p-3">
                  <Text className="text-xs font-bold text-red-700">{deleteDetailError}</Text>
                </View>
              ) : null}

              <View className="mt-5 flex-row gap-2.5">
                <Pressable
                  onPress={() => setDetailToDelete(null)}
                  disabled={deletingDetail}
                  className="flex-1 items-center justify-center rounded-2xl bg-[#E8F4ED] py-3"
                >
                  <Text className="text-xs font-extrabold text-pine">
                    {t(COMMON_CONSTANTS.CANCEL)}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => void handleConfirmDeleteDetail()}
                  disabled={deletingDetail}
                  className="flex-1 items-center justify-center rounded-2xl bg-[#C53030] py-3"
                >
                  {deletingDetail ? (
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
  // MAIN TEMPLATE TRANSACTIONS INTERFACE (budget.ttemplate_transaction)
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
            <MaterialCommunityIcons
              name="file-document-edit-outline"
              size={16}
              color="#0B3D2E"
            />
            <Text className="ml-2 text-[13px] font-bold text-pine">
              {t(TEMPLATE_TRANSACTIONS_CONSTANTS.TITLE, { count: templates.length })}
            </Text>
          </View>

          <View className="rounded-full bg-[#E6F4EC] px-3 py-1">
            <Text className="text-[11px] font-extrabold text-pine">
              budget.ttemplate_transaction
            </Text>
          </View>
        </View>

        {/* Search Input + Refresh Button */}
        <View className="flex-row items-center gap-2.5 mb-4">
          <View className="flex-1 flex-row items-center rounded-2xl bg-white px-4 py-3 shadow-sm border border-[#E5F0EA]">
            <Ionicons name="search-outline" size={20} color="#7A8C83" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t(TEMPLATE_TRANSACTIONS_CONSTANTS.SEARCH_PLACEHOLDER)}
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
            onPress={() => void loadTemplatesData()}
            className="h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm border border-[#E5F0EA] active:bg-[#E8F4ED]"
            accessibilityLabel={t(COMMON_CONSTANTS.REFRESH)}
          >
            <Ionicons name="refresh" size={20} color="#0B3D2E" />
          </Pressable>
        </View>

        {/* Templates List in Journal Card Style */}
        {loadingTemplates ? (
          <View className="py-10 items-center">
            <ActivityIndicator size="large" color="#0B3D2E" />
          </View>
        ) : filteredTemplates.length === 0 ? (
          <View className="mt-3 items-center rounded-3xl bg-white p-8 shadow-sm border border-[#E5F0EA]">
            <MaterialCommunityIcons
              name="file-document-edit-outline"
              size={36}
              color="#9BA8A2"
            />
            <Text className="mt-3 text-[15px] font-bold text-[#12211B]">
              {t(TEMPLATE_TRANSACTIONS_CONSTANTS.EMPTY_TITLE)}
            </Text>
            <Text className="mt-1 text-center text-[13px] text-[#5A6D64]">
              {t(TEMPLATE_TRANSACTIONS_CONSTANTS.EMPTY_DESC)}
            </Text>
          </View>
        ) : (
          <View className="gap-2.5">
            {filteredTemplates.map((tpl) => {
              const bizType = tpl.business_type_id
                ? businessTypeMap.get(tpl.business_type_id)
                : undefined;
              const count = detailCounts[tpl.id] ?? 0;

              return (
                <View
                  key={tpl.id}
                  className="flex-row items-center justify-between rounded-3xl bg-white px-4 py-3.5 shadow-sm border border-[#E7F1EC]"
                >
                  {/* Left Circular Icon + Template Details */}
                  <View className="flex-row items-center flex-1 mr-2">
                    <View
                      className="h-12 w-12 items-center justify-center rounded-full"
                      style={{ backgroundColor: '#E6F4EC' }}
                    >
                      <MaterialCommunityIcons
                        name="file-document-edit-outline"
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
                          {tpl.name}
                        </Text>
                        <View className="rounded-full bg-[#DFF5E8] px-2.5 py-0.5">
                          <Text className="text-[10px] font-extrabold text-[#0B3D2E]">
                            {tpl.code} • v{tpl.version}
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
                              ? t(TEMPLATE_TRANSACTIONS_CONSTANTS.LINE_SINGULAR)
                              : t(TEMPLATE_TRANSACTIONS_CONSTANTS.LINE_PLURAL)}
                          </Text>
                        </View>
                      </View>

                      <View className="mt-1 flex-row items-center">
                        <View className="h-4 w-4 items-center justify-center rounded-full bg-[#D9EBE0]">
                          <Text className="text-[8px] font-extrabold text-pine">
                            {(tpl.name[0] ?? 'T').toUpperCase()}
                          </Text>
                        </View>
                        <Text
                          className="ml-1.5 text-[12px] font-medium text-[#5A6D64] flex-1"
                          numberOfLines={1}
                        >
                          {tpl.description || `${t(COMMON_CONSTANTS.CODE)}: ${tpl.code}`}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Right Flat Action Icons: Details (ttemplate_transaction_det), Edit, Delete */}
                  <View className="flex-row items-center gap-1.5">
                    <Pressable
                      onPress={() => setSelectedTemplateForDetails(tpl)}
                      className="h-9 w-9 items-center justify-center rounded-full bg-[#E6F4EC] active:bg-[#CDE6D8]"
                      accessibilityLabel={t(TEMPLATE_TRANSACTIONS_CONSTANTS.DETAILS_HEADER)}
                    >
                      <Ionicons name="list-outline" size={18} color="#0B3D2E" />
                    </Pressable>

                    <Pressable
                      onPress={() => handleOpenEditTemplate(tpl)}
                      className="h-9 w-9 items-center justify-center rounded-full bg-[#F2F8F4] active:bg-[#DCECE3]"
                      accessibilityLabel={t(COMMON_CONSTANTS.EDIT)}
                    >
                      <Feather name="edit-2" size={16} color="#0B3D2E" />
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        setDeleteTemplateError(null);
                        setTemplateToDelete(tpl);
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
        onPress={handleOpenCreateTemplate}
        className="absolute bottom-5 right-5 h-16 w-16 items-center justify-center rounded-full bg-pine shadow-lg active:bg-pine-dark"
        accessibilityLabel={t(TEMPLATE_TRANSACTIONS_CONSTANTS.NEW_TITLE)}
      >
        <Ionicons name="add" size={32} color="#FFFFFF" />
      </Pressable>

      {/* Create / Edit Template Transaction Modal */}
      <Modal
        visible={isTemplateModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsTemplateModalOpen(false)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="max-h-[90%] rounded-t-3xl bg-[#F4FAF6] px-5 pt-5 pb-8">
            <View className="flex-row items-center justify-between pb-3 border-b border-[#DCECE3]">
              <View>
                <Text className="text-[11px] font-extrabold uppercase tracking-wider text-sage">
                  budget.ttemplate_transaction
                </Text>
                <Text className="text-xl font-extrabold text-pine">
                  {editingTemplate
                    ? t(TEMPLATE_TRANSACTIONS_CONSTANTS.EDIT_TITLE)
                    : t(TEMPLATE_TRANSACTIONS_CONSTANTS.NEW_TITLE)}
                </Text>
              </View>
              <Pressable
                onPress={() => setIsTemplateModalOpen(false)}
                className="h-9 w-9 items-center justify-center rounded-full bg-[#E2EFE8]"
              >
                <Ionicons name="close" size={20} color="#0B3D2E" />
              </Pressable>
            </View>

            <ScrollView className="mt-4" contentContainerClassName="gap-3.5 pb-4">
              {/* Business Type FK Dropdown (budget.tbusiness_type) */}
              <View>
                <Text className="mb-1 text-xs font-bold text-[#3B4F46]">
                  {t(TEMPLATE_TRANSACTIONS_CONSTANTS.BUSINESS_TYPE_LABEL)} *
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

              <View className="flex-row gap-2.5">
                <View className="flex-1">
                  <Text className="mb-1 text-xs font-bold text-[#3B4F46]">
                    {t(COMMON_CONSTANTS.CODE)} (code) *
                  </Text>
                  <TextInput
                    value={code}
                    onChangeText={setCode}
                    autoCapitalize="none"
                    placeholder="purchase, loan_payment"
                    placeholderTextColor="#8FA198"
                    className="rounded-xl bg-white px-3.5 py-2.5 text-sm text-[#12211B] border border-[#DCECE3]"
                  />
                </View>

                <View className="w-24">
                  <Text className="mb-1 text-xs font-bold text-[#3B4F46]">
                    {t(TEMPLATE_TRANSACTIONS_CONSTANTS.VERSION_LABEL)} *
                  </Text>
                  <TextInput
                    value={version}
                    onChangeText={setVersion}
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
                  value={name}
                  onChangeText={setName}
                  placeholder="Purchase"
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
                  placeholder="Purchase of some stuff"
                  placeholderTextColor="#8FA198"
                  className="rounded-xl bg-white px-3.5 py-2.5 text-sm text-[#12211B] border border-[#DCECE3]"
                />
              </View>

              <View>
                <Text className="mb-1 text-xs font-bold text-[#3B4F46]">
                  {t(TEMPLATE_TRANSACTIONS_CONSTANTS.INPUT_SCHEMA_LABEL)}
                </Text>
                <TextInput
                  value={inputSchemaText}
                  onChangeText={setInputSchemaText}
                  autoCapitalize="none"
                  placeholder="{}"
                  placeholderTextColor="#8FA198"
                  className="rounded-xl bg-white px-3.5 py-2.5 text-sm text-[#12211B] border border-[#DCECE3]"
                />
              </View>

              {templateFormError ? (
                <View className="rounded-2xl bg-red-50 p-3 border border-red-200">
                  <Text className="text-xs font-bold text-red-700">{templateFormError}</Text>
                </View>
              ) : null}

              <Pressable
                onPress={() => void handleSaveTemplate()}
                disabled={savingTemplate}
                className="mt-2 flex-row items-center justify-center rounded-2xl bg-pine py-4 shadow-md active:opacity-90 disabled:opacity-50"
              >
                {savingTemplate ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
                    <Text className="ml-2 text-sm font-extrabold text-white">
                      {editingTemplate
                        ? t(COMMON_CONSTANTS.SAVE_CHANGES)
                        : t(TEMPLATE_TRANSACTIONS_CONSTANTS.CREATE_BTN)}
                    </Text>
                  </>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Confirm Logical Delete Template Modal */}
      <Modal
        visible={Boolean(templateToDelete)}
        animationType="fade"
        transparent
        onRequestClose={() => setTemplateToDelete(null)}
      >
        <View className="flex-1 items-center justify-center bg-black/40 px-5">
          <View className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-[#FFF5F5] self-center">
              <Feather name="trash-2" size={22} color="#C53030" />
            </View>
            <Text className="mt-3 text-center text-lg font-extrabold text-[#12211B]">
              {t(TEMPLATE_TRANSACTIONS_CONSTANTS.DELETE_TITLE)}
            </Text>
            <Text className="mt-1.5 text-center text-[13px] text-[#5A6D64]">
              {t(COMMON_CONSTANTS.LOGICAL_DELETE_DESC, {
                name: templateToDelete?.name || '',
              })}
            </Text>

            {deleteTemplateError ? (
              <View className="mt-3 rounded-xl bg-red-50 p-3">
                <Text className="text-xs font-bold text-red-700">{deleteTemplateError}</Text>
              </View>
            ) : null}

            <View className="mt-5 flex-row gap-2.5">
              <Pressable
                onPress={() => setTemplateToDelete(null)}
                disabled={deletingTemplate}
                className="flex-1 items-center justify-center rounded-2xl bg-[#E8F4ED] py-3"
              >
                <Text className="text-xs font-extrabold text-pine">
                  {t(COMMON_CONSTANTS.CANCEL)}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => void handleConfirmDeleteTemplate()}
                disabled={deletingTemplate}
                className="flex-1 items-center justify-center rounded-2xl bg-[#C53030] py-3"
              >
                {deletingTemplate ? (
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

