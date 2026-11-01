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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { COMMON_CONSTANTS, JOURNAL_CONSTANTS } from '../i18n/constants';
import type { BudgetSchema, HouseholdRow } from '../lib/budget-schema';

type TransactionRow = BudgetSchema['Tables']['ttransaction']['Row'];
type TransactionDetailRow = BudgetSchema['Tables']['ttransaction_detail']['Row'];
type AccountRow = BudgetSchema['Tables']['taccount']['Row'];
type AuxiliarRow = BudgetSchema['Tables']['tauxiliar']['Row'];
type BudgetTypeRow = BudgetSchema['Tables']['tbudget_type']['Row'];
type UserRow = BudgetSchema['Tables']['tuser']['Row'];
type TemplateTransactionRow = BudgetSchema['Tables']['ttemplate_transaction']['Row'];

interface JournalViewProps {
  userId: string;
  activeHousehold: HouseholdRow | null;
  households: HouseholdRow[];
  userEmail: string;
  onSelectHousehold: (household: HouseholdRow) => void;
  onSwitchHousehold: () => void;
}

interface TransactionItemDraft {
  id: string;
  category: string;
  amount: string;
  concept: string;
}

interface DisplayTransactionItem {
  id: string;
  concept: string;
  categoryLabel: string;
  categoryTheme: 'mint' | 'peach' | 'green' | 'neutral';
  iconName: string;
  iconBg: string;
  iconColor: string;
  memberName: string;
  timeOrSub: string;
  amount: number;
  type: 'expense' | 'income';
  paymentLabel: string;
  dateGroupLabel: string;
  rawDate: string;
  detailsCount: number;
}

const DEMO_FALLBACK_ITEMS: DisplayTransactionItem[] = [
  {
    id: 'demo-1',
    concept: 'Jumbo Bilbao',
    categoryLabel: 'Comida',
    categoryTheme: 'mint',
    iconName: 'cart-outline',
    iconBg: '#E6F4EC',
    iconColor: '#0B3D2E',
    memberName: 'Valentina',
    timeOrSub: '14:32',
    amount: 64200,
    type: 'expense',
    paymentLabel: 'Débito Nido',
    dateGroupLabel: 'Hoy, 15 de Mayo',
    rawDate: '2026-05-15T14:32:00Z',
    detailsCount: 2,
  },
  {
    id: 'demo-2',
    concept: 'Farmacias A...',
    categoryLabel: 'Medicamentos',
    categoryTheme: 'peach',
    iconName: 'medical-outline',
    iconBg: '#FFF1E6',
    iconColor: '#9A4B1A',
    memberName: 'Carlos',
    timeOrSub: '11:15',
    amount: 12800,
    type: 'expense',
    paymentLabel: 'Boleta split 50/50',
    dateGroupLabel: 'Hoy, 15 de Mayo',
    rawDate: '2026-05-15T11:15:00Z',
    detailsCount: 1,
  },
  {
    id: 'demo-3',
    concept: 'Copec Vitacura',
    categoryLabel: 'Combustible',
    categoryTheme: 'mint',
    iconName: 'car-sport-outline',
    iconBg: '#E6F4EC',
    iconColor: '#0B3D2E',
    memberName: 'Carlos',
    timeOrSub: '18:40',
    amount: 32000,
    type: 'expense',
    paymentLabel: 'Auto familiar',
    dateGroupLabel: 'Ayer, 14 de Mayo',
    rawDate: '2026-05-14T18:40:00Z',
    detailsCount: 1,
  },
  {
    id: 'demo-4',
    concept: 'Netflix Familiar',
    categoryLabel: 'Fijo',
    categoryTheme: 'neutral',
    iconName: 'tv-outline',
    iconBg: '#E6F4EC',
    iconColor: '#0B3D2E',
    memberName: 'Débito automático',
    timeOrSub: 'Hogar',
    amount: 10990,
    type: 'expense',
    paymentLabel: 'Recurrente',
    dateGroupLabel: 'Ayer, 14 de Mayo',
    rawDate: '2026-05-14T09:00:00Z',
    detailsCount: 1,
  },
  {
    id: 'demo-5',
    concept: 'Librería Antártica',
    categoryLabel: 'Materiales',
    categoryTheme: 'mint',
    iconName: 'book-outline',
    iconBg: '#E6F4EC',
    iconColor: '#0B3D2E',
    memberName: 'Valentina',
    timeOrSub: 'Colegio Mateo',
    amount: 18500,
    type: 'expense',
    paymentLabel: 'Escolares',
    dateGroupLabel: 'Lunes, 12 de Mayo',
    rawDate: '2026-05-12T16:10:00Z',
    detailsCount: 3,
  },
  {
    id: 'demo-6',
    concept: 'Ahorro Vacaciones',
    categoryLabel: 'Ahorro',
    categoryTheme: 'green',
    iconName: 'wallet-outline',
    iconBg: '#D8F5E5',
    iconColor: '#0B3D2E',
    memberName: 'Depósito de Carlos',
    timeOrSub: '',
    amount: 150000,
    type: 'income',
    paymentLabel: 'Meta Conjunta',
    dateGroupLabel: 'Lunes, 12 de Mayo',
    rawDate: '2026-05-12T10:00:00Z',
    detailsCount: 1,
  },
];

function formatMoney(value: number): string {
  const abs = Math.round(Math.abs(value));
  return '$' + abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatDateHeading(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return 'Recientes';

  const now = new Date();
  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const months = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  if (isSameDay) {
    return `Hoy, ${date.getDate()} de ${months[date.getMonth()]}`;
  }
  return `${days[date.getDay()]}, ${date.getDate()} de ${months[date.getMonth()]}`;
}

function formatTimeFromIso(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '12:00';
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function createEmptyItem(
  defaultCategoryId = '',
  initialAmount = '',
): TransactionItemDraft {
  return {
    id: Math.random().toString(36).slice(2, 10),
    category: defaultCategoryId,
    amount: initialAmount,
    concept: '',
  };
}

export default function JournalView({
  userId,
  activeHousehold,
  households,
  userEmail,
  onSelectHousehold,
  onSwitchHousehold,
}: JournalViewProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string>('Todos');
  const [loading, setLoading] = useState(true);
  const [isHouseholdPickerOpen, setIsHouseholdPickerOpen] = useState(false);
  const [userHouseholds, setUserHouseholds] = useState<
    {
      role: string | null;
      member_type: string;
      auxiliar_id: string | null;
      household: HouseholdRow;
    }[]
  >([]);

  // Database records
  const [dbTransactions, setDbTransactions] = useState<TransactionRow[]>([]);
  const [dbDetails, setDbDetails] = useState<TransactionDetailRow[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [auxiliars, setAuxiliars] = useState<AuxiliarRow[]>([]);
  const [budgetTypes, setBudgetTypes] = useState<BudgetTypeRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [templates, setTemplates] = useState<TemplateTransactionRow[]>([]);

  // Modal Create Transaction state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Minimal transaction fields for budget.f_register_transaction
  const [txType, setTxType] = useState<'expense' | 'income'>('expense');
  const [concept, setConcept] = useState('');
  const [operationCode, setOperationCode] = useState('');
  const [externalReference, setExternalReference] = useState('');

  // Items for budget.f_register_transaction (p_items)
  const [items, setItems] = useState<TransactionItemDraft[]>([]);

  const loadJournalData = async () => {
    setLoading(true);
    try {
      // 1. Join budget.thousehold with budget.thousehold_member filtered by user_id
      const userHhRes = await supabase
        .schema('budget')
        .from('thousehold_member')
        .select('id, role, member_type, user_id, auxiliar_id, thousehold(*)')
        .eq('user_id', userId)
        .eq('status', 'active');

      const joinedUserHouseholds: {
        role: string | null;
        member_type: string;
        auxiliar_id: string | null;
        household: HouseholdRow;
      }[] = [];

      if (userHhRes.data) {
        for (const row of userHhRes.data) {
          const hh = row.thousehold as unknown as HouseholdRow | null;
          if (hh) {
            joinedUserHouseholds.push({
              role: row.role,
              member_type: row.member_type,
              auxiliar_id: (row as Record<string, unknown>).auxiliar_id as string | null,
              household: hh,
            });
          }
        }
        setUserHouseholds(joinedUserHouseholds);
        if (!activeHousehold && joinedUserHouseholds.length > 0) {
          onSelectHousehold(joinedUserHouseholds[0].household);
        }
      }

      const targetHouseholdId =
        activeHousehold?.id ?? joinedUserHouseholds[0]?.household.id ?? null;

      // If the user has no household assigned or selected, clear all household-scoped state and return
      if (!targetHouseholdId) {
        setDbTransactions([]);
        setDbDetails([]);
        setUsers([]);
        setAuxiliars([]);
        return;
      }

      // 2. Load household members + transactions + catalogs strictly for targetHouseholdId
      let txQuery = supabase
        .schema('budget')
        .from('ttransaction')
        .select('*')
        .eq('household_id', targetHouseholdId)
        .eq('ledger_book', 'operating')
        .in('type', ['income', 'expense'])
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('transaction_date', { ascending: false })
        .limit(50);

      // Filter by selected member's user_id (created_by in budget.ttransaction)
      if (selectedFilter !== 'Todos') {
        txQuery = txQuery.eq('created_by', selectedFilter);
      }

      const membersQuery = supabase
        .schema('budget')
        .from('thousehold_member')
        .select('id, role, member_type, user_id, tuser!thousehold_member_user_id_fkey(*)')
        .eq('household_id', targetHouseholdId)
        .eq('status', 'active');

      const [txRes, detRes, accRes, auxRes, btRes, membersRes, tplRes] = await Promise.all([
        txQuery,
        supabase.schema('budget').from('ttransaction_detail').select('*').limit(150),
        supabase.schema('budget').from('taccount').select('*').order('name'),
        supabase
          .schema('budget')
          .from('tauxiliar')
          .select('*')
          .eq('household_id', targetHouseholdId)
          .order('name'),
        supabase.schema('budget').from('tbudget_type').select('*').order('name'),
        membersQuery,
        supabase.schema('budget').from('ttemplate_transaction').select('*').order('name'),
      ]);

      setDbTransactions(txRes.data ?? []);
      setDbDetails(detRes.data ?? []);
      if (accRes.data) setAccounts(accRes.data);
      setAuxiliars(auxRes.data ?? []);
      if (btRes.data) setBudgetTypes(btRes.data);
      if (membersRes.data) {
        const mappedMembers = membersRes.data
          .map((m) => (m as Record<string, unknown>).tuser as UserRow | null)
          .filter((u): u is UserRow => Boolean(u));
        // Deduplicate by user id
        const uniqueMembers = Array.from(
          new Map(mappedMembers.map((u) => [u.id, u])).values(),
        );
        setUsers(uniqueMembers);
      } else {
        setUsers([]);
      }
      if (tplRes.data) setTemplates(tplRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadJournalData();
  }, [activeHousehold?.id, userId, selectedFilter]);

  // Filter pills populated strictly from the active household's members in budget.thousehold_member -> budget.tuser
  const filterPills = useMemo(() => {
    const pills: {
      id: string;
      userId?: string;
      label: string;
      type: 'all' | 'member' | 'family';
      color?: string;
    }[] = [{ id: 'Todos', label: t(JOURNAL_CONSTANTS.ALL_MEMBERS), type: 'all' }];

    for (const u of users) {
      pills.push({
        id: u.id,
        userId: u.id,
        label: u.full_name.trim() || u.email_user,
        type: 'member',
        color: '#0B3D2E',
      });
    }

    return pills;
  }, [users, t]);

  // Map DB transactions + details into visual items
  const displayItems: DisplayTransactionItem[] = useMemo(() => {
    const btMap = new Map(budgetTypes.map((b) => [b.id, b.name]));
    const userMap = new Map(users.map((u) => [u.id, u.full_name.trim() || u.email_user]));

    const mappedDb: DisplayTransactionItem[] = dbTransactions.map((tx) => {
      const txDetails = dbDetails.filter((d) => d.transaction_id === tx.id);
      const firstDetail = txDetails[0];
      const categoryLabel =
        (firstDetail?.budget_type_id && btMap.get(firstDetail.budget_type_id)) ||
        ((tx.input_data as Record<string, unknown>)?.category as string) ||
        (tx.type === 'income' ? 'Ingreso' : 'Comida');

      const memberFromDb =
        (tx.created_by && userMap.get(tx.created_by)) ||
        ((tx.input_data as Record<string, unknown>)?.member as string) ||
        userEmail.split('@')[0] ||
        'Miembro';

      const isIncome = tx.type === 'income';
      const catLower = categoryLabel.toLowerCase();
      const categoryTheme: DisplayTransactionItem['categoryTheme'] = isIncome
        ? 'green'
        : catLower.includes('medic')
          ? 'peach'
          : catLower.includes('fijo')
            ? 'neutral'
            : 'mint';

      const iconName = isIncome
        ? 'wallet-outline'
        : catLower.includes('medic')
          ? 'medical-outline'
          : catLower.includes('combust')
            ? 'car-sport-outline'
            : catLower.includes('fijo')
              ? 'tv-outline'
              : 'cart-outline';

      const iconBg = isIncome
        ? '#D8F5E5'
        : catLower.includes('medic')
          ? '#FFF1E6'
          : '#E6F4EC';

      const iconColor = catLower.includes('medic') ? '#9A4B1A' : '#0B3D2E';

      return {
        id: tx.id,
        concept: tx.concept || firstDetail?.description || 'Movimiento registrado',
        categoryLabel,
        categoryTheme,
        iconName,
        iconBg,
        iconColor,
        memberName: memberFromDb,
        timeOrSub: formatTimeFromIso(tx.transaction_date),
        amount: Number(tx.amount) || 0,
        type: isIncome ? 'income' : 'expense',
        paymentLabel: tx.external_reference || tx.recorded_via || 'Débito Nido',
        dateGroupLabel: formatDateHeading(tx.transaction_date),
        rawDate: tx.transaction_date,
        detailsCount: txDetails.length,
      };
    });

    return mappedDb.filter((item) => {
      const matchesSearch =
        !searchQuery.trim() ||
        item.concept.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.categoryLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.paymentLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.memberName.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesSearch;
    });
  }, [dbTransactions, dbDetails, budgetTypes, users, searchQuery, userEmail]);

  // Group transactions by date heading
  const groupedSections = useMemo(() => {
    const groups: { title: string; netTotal: number; items: DisplayTransactionItem[] }[] = [];
    for (const item of displayItems) {
      let group = groups.find((g) => g.title === item.dateGroupLabel);
      if (!group) {
        group = { title: item.dateGroupLabel, netTotal: 0, items: [] };
        groups.push(group);
      }
      group.items.push(item);
      group.netTotal += item.type === 'income' ? item.amount : -item.amount;
    }
    return groups;
  }, [displayItems]);

  // Summary metrics from DB
  const totalExpenses = useMemo(() => {
    return dbTransactions
      .filter((t) => t.type === 'expense')
      .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
  }, [dbTransactions]);

  const totalCount = dbTransactions.length;

  // Computed total amount from all items
  const computedTotalAmount = useMemo(() => {
    return items.reduce((acc, it) => acc + (parseFloat(it.amount) || 0), 0);
  }, [items]);

  // Current user's default auxiliar in the active household
  const currentUserAuxiliarId = useMemo(() => {
    const targetHhId = activeHousehold?.id;
    if (!targetHhId) return undefined;
    const match = userHouseholds.find((h) => h.household.id === targetHhId);
    return match?.auxiliar_id ?? undefined;
  }, [userHouseholds, activeHousehold?.id]);

  // Open Modal & initialize minimal form
  const handleOpenCreateModal = () => {
    setFormError(null);
    setFormSuccess(null);
    setTxType('expense');
    setConcept('');
    setOperationCode(`OP-${Date.now().toString().slice(-6)}`);
    setExternalReference('');
    setShowAdvanced(false);
    const defaultCat = budgetTypes[0]?.category_key || budgetTypes[0]?.id || '';
    setItems([createEmptyItem(defaultCat, '')]);
    setIsModalOpen(true);
  };

  const handleAddItem = () => {
    const defaultCat = budgetTypes[0]?.category_key || budgetTypes[0]?.id || '';
    setItems((prev) => [...prev, createEmptyItem(defaultCat, '')]);
  };

  const handleRemoveItem = (itemId: string) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== itemId) : prev));
  };

  const handleUpdateItem = (
    itemId: string,
    field: keyof TransactionItemDraft,
    value: string,
  ) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        return { ...item, [field]: value };
      }),
    );
  };

  // Save transaction via budget.f_register_transaction RPC
  const handleSaveTransaction = async () => {
    setFormError(null);
    setFormSuccess(null);

    const trimmedConcept = concept.trim();
    if (!trimmedConcept) {
      setFormError(t(JOURNAL_CONSTANTS.ERR_CONCEPT_REQUIRED));
      return;
    }

    if (items.length === 0) {
      setFormError(t(JOURNAL_CONSTANTS.ERR_ITEM_AMOUNT));
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const parsedItAmount = parseFloat(it.amount);
      if (Number.isNaN(parsedItAmount) || parsedItAmount <= 0) {
        setFormError(
          `${t(JOURNAL_CONSTANTS.ITEM_NUMBER, { num: i + 1 })}: ${t(JOURNAL_CONSTANTS.ERR_ITEM_AMOUNT)}`,
        );
        return;
      }
      if (txType === 'expense' && !it.category) {
        setFormError(
          `${t(JOURNAL_CONSTANTS.ITEM_NUMBER, { num: i + 1 })}: ${t(JOURNAL_CONSTANTS.ERR_ITEM_CATEGORY)}`,
        );
        return;
      }
    }

    const targetHouseholdId = activeHousehold?.id;
    if (!targetHouseholdId) {
      setFormError(t(JOURNAL_CONSTANTS.EMPTY_NO_HOUSEHOLD_TITLE));
      return;
    }

    setSaving(true);
    try {
      const itemsPayload = items.map((it, idx) => {
        const itemAmt = parseFloat(it.amount);
        const itemConcept = it.concept.trim() || trimmedConcept;
        return {
          category: txType === 'income' ? 'income_general' : it.category,
          concept: itemConcept,
          description: itemConcept,
          amount: itemAmt,
          quantity: 1,
          unit_price: itemAmt,
          unit_measure_code: 'unit',
          item_code: `ITM-${String(idx + 1).padStart(3, '0')}`,
        };
      });

      // Auto-generate source summary text from items
      const generatedSourceText =
        items.length > 1
          ? `${txType === 'expense' ? 'Gastos combinados' : 'Ingresos combinados'}: ${items
              .map((it) => it.concept.trim() || trimmedConcept)
              .join(', ')}`
          : trimmedConcept;

      const generatedOpCode =
        operationCode.trim() || `OP-${Date.now().toString().slice(-6)}`;

      // Call database function budget.f_register_transaction
      const { data, error: rpcError } = await supabase.rpc('f_register_transaction', {
        p_household_id: targetHouseholdId,
        p_concept: trimmedConcept,
        p_amount: computedTotalAmount,
        p_type: txType,
        p_transaction_date: new Date().toISOString(),
        p_operation_code: generatedOpCode,
        p_external_reference: externalReference.trim() || undefined,
        p_source_text: generatedSourceText,
        p_recorded_via: 'app',
        p_user_id: userId,
        p_auxiliar_id: currentUserAuxiliarId || undefined,
        p_items: itemsPayload,
      });

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      const res = data as { success?: boolean; message?: string; error?: string };
      if (res && res.success === false) {
        throw new Error(res.message || res.error || 'Failed to register transaction');
      }

      await loadJournalData();
      setIsModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error inesperado al guardar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-[#F0F8F3]">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pt-3 pb-28"
        showsVerticalScrollIndicator={false}
      >
        {/* Top Subheader: Household Selector Pill + Notification Bell + Avatar */}
        <View className="flex-row items-center justify-between mb-3">
          <View className="w-8" />

          <Pressable
            onPress={() => setIsHouseholdPickerOpen((prev) => !prev)}
            className="flex-row items-center rounded-full bg-[#E1F0E7] px-4 py-2 active:bg-[#D2E7DA]"
          >
            <Text className="text-[14px] font-bold text-pine">
              {activeHousehold?.name ??
                userHouseholds[0]?.household.name ??
                households[0]?.name ??
                t(JOURNAL_CONSTANTS.SELECT_HOUSEHOLD)}
            </Text>
            <Ionicons
              name={isHouseholdPickerOpen ? 'chevron-up' : 'chevron-down'}
              size={16}
              color="#0B3D2E"
              style={{ marginLeft: 6 }}
            />
          </Pressable>

          <View className="flex-row items-center gap-3">
            <Pressable
              className="h-9 w-9 items-center justify-center rounded-full active:bg-[#E1F0E7]"
              accessibilityLabel="Notifications"
            >
              <Ionicons name="notifications-outline" size={21} color="#1F2D27" />
            </Pressable>
            <View className="h-9 w-9 items-center justify-center rounded-full bg-[#D2E7DA] border border-white">
              <Text className="text-xs font-extrabold text-pine">
                {userEmail.slice(0, 2).toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Household Dropdown List (populated from budget.thousehold JOIN budget.thousehold_member WHERE user_id = session.user.id) */}
        {isHouseholdPickerOpen ? (
          <View className="mb-3 rounded-2xl bg-white p-3 shadow-sm border border-[#D8E9DF] gap-1.5">
            <Text className="px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-sage">
              {t(JOURNAL_CONSTANTS.YOUR_HOUSEHOLDS)}
            </Text>
            {userHouseholds.length === 0 ? (
              <Text className="px-2 py-2 text-xs text-sage">
                {t(JOURNAL_CONSTANTS.NO_ASSOCIATED_HOUSEHOLDS)}
              </Text>
            ) : (
              userHouseholds.map(({ household, role, member_type }) => {
                const isSelected = activeHousehold?.id === household.id;
                return (
                  <Pressable
                    key={household.id}
                    onPress={() => {
                      onSelectHousehold(household);
                      setIsHouseholdPickerOpen(false);
                    }}
                    className={`flex-row items-center justify-between rounded-xl px-3 py-2.5 ${
                      isSelected ? 'bg-[#E1F0E7]' : 'active:bg-[#F4FAF6]'
                    }`}
                  >
                    <View className="flex-row items-center">
                      <Ionicons
                        name={isSelected ? 'checkmark-circle' : 'home-outline'}
                        size={17}
                        color="#0B3D2E"
                      />
                      <View className="ml-2.5">
                        <Text className="text-sm font-extrabold text-pine">{household.name}</Text>
                        <Text className="text-[11px] text-sage">
                          {t(COMMON_CONSTANTS.ROLE)}: {role ?? 'member'} • {member_type} •{' '}
                          {t(COMMON_CONSTANTS.CURRENCY)}: {household.currency ?? 'BOB'}
                        </Text>
                      </View>
                    </View>
                    {isSelected ? (
                      <View className="rounded-full bg-pine px-2.5 py-0.5">
                        <Text className="text-[10px] font-bold text-white">
                          {t(COMMON_CONSTANTS.ACTIVE)}
                        </Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })
            )}
          </View>
        ) : null}

        {/* Search Input + Filter Button */}
        <View className="flex-row items-center gap-2.5">
          <View className="flex-1 flex-row items-center rounded-2xl bg-white px-4 py-3 shadow-sm border border-[#E5F0EA]">
            <Ionicons name="search-outline" size={20} color="#7A8C83" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t(JOURNAL_CONSTANTS.SEARCH_PLACEHOLDER)}
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
            onPress={() => void loadJournalData()}
            className="h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm border border-[#E5F0EA] active:bg-[#E8F4ED]"
            accessibilityLabel={t(COMMON_CONSTANTS.REFRESH)}
          >
            <Ionicons name="options-outline" size={21} color="#0B3D2E" />
          </Pressable>
        </View>

        {/* Horizontal Member Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-3.5"
          contentContainerClassName="gap-2 pr-4"
        >
          {filterPills.map((pill) => {
            const isSelected = selectedFilter === pill.id;
            return (
              <Pressable
                key={pill.id}
                onPress={() => setSelectedFilter(pill.id)}
                className={`flex-row items-center rounded-full px-4 py-2 border ${
                  isSelected
                    ? 'bg-pine border-pine'
                    : 'bg-white border-[#E2EFE8]'
                }`}
              >
                {pill.type === 'all' ? (
                  <Ionicons
                    name="people"
                    size={15}
                    color={isSelected ? '#FFFFFF' : '#0B3D2E'}
                  />
                ) : pill.type === 'family' ? (
                  <MaterialCommunityIcons
                    name="human-male-female-child"
                    size={16}
                    color={isSelected ? '#FFFFFF' : '#B8541A'}
                  />
                ) : (
                  <View
                    className="h-5 w-5 items-center justify-center rounded-full"
                    style={{ backgroundColor: isSelected ? '#2B6E57' : '#D9EBE0' }}
                  >
                    <Text
                      className={`text-[10px] font-extrabold ${
                        isSelected ? 'text-white' : 'text-pine'
                      }`}
                    >
                      {pill.label[0]}
                    </Text>
                  </View>
                )}

                <Text
                  className={`ml-2 text-[13px] font-bold ${
                    isSelected ? 'text-white' : 'text-[#1F2D27]'
                  }`}
                >
                  {pill.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Monthly Summary Card */}
        <View className="mt-4 rounded-3xl bg-white p-5 shadow-sm border border-[#E5F0EA]">
          <View className="flex-row items-start justify-between">
            <View>
              <View className="flex-row items-center">
                <Text className="text-[11px] font-extrabold tracking-wider text-[#3B4F46]">
                  {t(JOURNAL_CONSTANTS.MONTHLY_EXPENSES_TITLE)}
                </Text>
                <View className="mx-1.5 h-2 w-2 rounded-full bg-[#C85A17]" />
                <Text className="text-[11px] font-bold text-[#3B4F46]">
                  {t(JOURNAL_CONSTANTS.TRANSACTIONS_COUNT, { count: totalCount })}
                </Text>
              </View>
              <Text className="mt-1 text-[30px] font-extrabold tracking-tight text-pine">
                {formatMoney(totalExpenses)}
              </Text>
            </View>

            <View className="h-11 w-11 items-center justify-center rounded-full bg-[#E6F4EC]">
              <Ionicons name="calendar-outline" size={20} color="#0B3D2E" />
            </View>
          </View>

          {/* Progress Bar */}
          <View className="mt-3.5 h-2.5 w-full overflow-hidden rounded-full bg-[#E7F2EC]">
            <View
              className="h-full rounded-full bg-pine"
              style={{
                width: `${totalExpenses > 0 ? Math.min(100, Math.round((totalExpenses / 200000) * 100)) : 0}%`,
              }}
            />
          </View>

          <View className="mt-2 flex-row items-center justify-between">
            <Text className="text-[11px] font-bold text-[#44564E]">
              {t(JOURNAL_CONSTANTS.ESTIMATED_LIMIT_PCT, {
                pct:
                  totalExpenses > 0
                    ? Math.min(100, Math.round((totalExpenses / 200000) * 100))
                    : 0,
              })}
            </Text>
            <Text className="text-[11px] font-bold text-[#44564E]">
              {t(JOURNAL_CONSTANTS.DAYS_REMAINING, { days: 16 })}
            </Text>
          </View>
        </View>

        {/* Transactions Feed Grouped by Date */}
        {loading ? (
          <View className="py-10 items-center">
            <ActivityIndicator size="large" color="#0B3D2E" />
          </View>
        ) : groupedSections.length === 0 ? (
          <View className="mt-5 items-center rounded-3xl bg-white p-8 shadow-sm border border-[#E5F0EA]">
            <Ionicons name="receipt-outline" size={36} color="#9BA8A2" />
            <Text className="mt-3 text-[15px] font-bold text-[#12211B]">
              {activeHousehold || userHouseholds.length > 0
                ? t(JOURNAL_CONSTANTS.EMPTY_WITH_HOUSEHOLD_TITLE)
                : t(JOURNAL_CONSTANTS.EMPTY_NO_HOUSEHOLD_TITLE)}
            </Text>
            <Text className="mt-1 text-center text-[13px] text-[#5A6D64]">
              {activeHousehold || userHouseholds.length > 0
                ? t(JOURNAL_CONSTANTS.EMPTY_WITH_HOUSEHOLD_DESC)
                : t(JOURNAL_CONSTANTS.EMPTY_NO_HOUSEHOLD_DESC)}
            </Text>
          </View>
        ) : (
          groupedSections.map((group) => {
            const isPositiveNet = group.netTotal > 0;
            const netFormatted = isPositiveNet
              ? `+${formatMoney(group.netTotal)} neto`
              : `-${formatMoney(group.netTotal)}`;

            return (
              <View key={group.title} className="mt-5">
                {/* Date Group Header */}
                <View className="mb-2.5 flex-row items-center justify-between px-1">
                  <Text className="text-[13px] font-bold text-[#3B4F46]">{group.title}</Text>
                  <Text
                    className={`text-[12px] font-extrabold ${
                      isPositiveNet ? 'text-[#0E6B45]' : 'text-[#44564E]'
                    }`}
                  >
                    {netFormatted}
                  </Text>
                </View>

                {/* Group Items */}
                <View className="gap-2.5">
                  {group.items.map((item) => {
                    const isIncome = item.type === 'income';
                    const badgeStyle =
                      item.categoryTheme === 'peach'
                        ? 'bg-[#FDE6D5] text-[#8E3B10]'
                        : item.categoryTheme === 'green'
                          ? 'bg-[#8EF2B8] text-[#073B22]'
                          : item.categoryTheme === 'neutral'
                            ? 'bg-[#E3ECE7] text-[#3B4F46]'
                            : 'bg-[#DFF5E8] text-[#0B3D2E]';

                    return (
                      <View
                        key={item.id}
                        className="flex-row items-center justify-between rounded-3xl bg-white px-4 py-3.5 shadow-sm border border-[#E7F1EC]"
                      >
                        {/* Left Icon + Info */}
                        <View className="flex-row items-center flex-1 mr-2">
                          <View
                            className="h-12 w-12 items-center justify-center rounded-full"
                            style={{ backgroundColor: item.iconBg }}
                          >
                            <Ionicons
                              name={item.iconName as never}
                              size={22}
                              color={item.iconColor}
                            />
                          </View>

                          <View className="ml-3 flex-1">
                            <View className="flex-row items-center flex-wrap gap-1.5">
                              <Text
                                className="text-[15px] font-extrabold text-[#12211B]"
                                numberOfLines={1}
                              >
                                {item.concept}
                              </Text>
                              <View className={`rounded-full px-2.5 py-0.5 ${badgeStyle}`}>
                                <Text className="text-[10px] font-extrabold">
                                  {item.categoryLabel}
                                </Text>
                              </View>
                            </View>

                            <View className="mt-1 flex-row items-center">
                              <View className="h-4 w-4 items-center justify-center rounded-full bg-[#D9EBE0]">
                                <Text className="text-[8px] font-extrabold text-pine">
                                  {item.memberName[0]}
                                </Text>
                              </View>
                              <Text
                                className="ml-1.5 text-[12px] font-medium text-[#5A6D64]"
                                numberOfLines={1}
                              >
                                {item.memberName}
                                {item.timeOrSub ? ` • ${item.timeOrSub}` : ''}
                              </Text>
                            </View>
                          </View>
                        </View>

                        {/* Right Amount + Payment Method */}
                        <View className="items-end">
                          <Text
                            className={`text-[18px] font-extrabold ${
                              isIncome ? 'text-[#0B5D3B]' : 'text-[#12211B]'
                            }`}
                          >
                            {isIncome ? '+' : '-'}
                            {formatMoney(item.amount)}
                          </Text>
                          <Text
                            className={`mt-0.5 text-[11px] font-bold ${
                              isIncome ? 'text-[#0B5D3B]' : 'text-[#5A6D64]'
                            }`}
                          >
                            {item.paymentLabel}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Floating Action Button (+) to open Create Transaction Modal */}
      <Pressable
        onPress={handleOpenCreateModal}
        className="absolute bottom-5 right-5 h-16 w-16 items-center justify-center rounded-full bg-pine shadow-lg active:bg-pine-dark"
        accessibilityLabel={t(JOURNAL_CONSTANTS.NEW_TRANSACTION_TITLE)}
      >
        <Ionicons name="add" size={32} color="#FFFFFF" />
      </Pressable>

      {/* Create Transaction Modal (Inserts into budget.ttransaction + budget.ttransaction_detail) */}
      <Modal
        visible={isModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsModalOpen(false)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="max-h-[92%] rounded-t-3xl bg-[#F4FAF6] pt-4 pb-6 px-5">
            {/* Modal Header */}
            <View className="flex-row items-center justify-between pb-3 border-b border-[#DCEBE2]">
              <View>
                <Text className="text-lg font-extrabold text-pine">
                  {t(JOURNAL_CONSTANTS.NEW_TRANSACTION_TITLE)}
                </Text>
                <Text className="text-[11px] text-sage">
                  {t(JOURNAL_CONSTANTS.NEW_TRANSACTION_SUBTITLE)}
                </Text>
              </View>
              <Pressable
                onPress={() => setIsModalOpen(false)}
                className="h-9 w-9 items-center justify-center rounded-full bg-[#E3F1E9]"
              >
                <Ionicons name="close" size={20} color="#0B3D2E" />
              </Pressable>
            </View>

            <ScrollView
              className="mt-3"
              contentContainerClassName="pb-6 gap-4"
              showsVerticalScrollIndicator={false}
            >
              {/* Section 1: Main Header Data */}
              <View className="rounded-3xl bg-white p-4 border border-[#E2EFE8] gap-3">
                <Text className="text-xs font-extrabold uppercase tracking-wider text-pine">
                  {t(JOURNAL_CONSTANTS.HEADER_SECTION_TITLE)}
                </Text>

                {/* Expense vs Income switch */}
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => setTxType('expense')}
                    className={`flex-1 flex-row items-center justify-center rounded-2xl py-2.5 border ${
                      txType === 'expense'
                        ? 'bg-pine border-pine'
                        : 'bg-[#F4FAF6] border-[#DCEBE2]'
                    }`}
                  >
                    <Ionicons
                      name="arrow-down-circle-outline"
                      size={17}
                      color={txType === 'expense' ? '#FFFFFF' : '#0B3D2E'}
                    />
                    <Text
                      className={`ml-1.5 text-xs font-bold ${
                        txType === 'expense' ? 'text-white' : 'text-pine'
                      }`}
                    >
                      {t(JOURNAL_CONSTANTS.EXPENSE_TYPE)}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setTxType('income')}
                    className={`flex-1 flex-row items-center justify-center rounded-2xl py-2.5 border ${
                      txType === 'income'
                        ? 'bg-[#0E6B45] border-[#0E6B45]'
                        : 'bg-[#F4FAF6] border-[#DCEBE2]'
                    }`}
                  >
                    <Ionicons
                      name="arrow-up-circle-outline"
                      size={17}
                      color={txType === 'income' ? '#FFFFFF' : '#0B3D2E'}
                    />
                    <Text
                      className={`ml-1.5 text-xs font-bold ${
                        txType === 'income' ? 'text-white' : 'text-pine'
                      }`}
                    >
                      {t(JOURNAL_CONSTANTS.INCOME_TYPE)}
                    </Text>
                  </Pressable>
                </View>

                {/* Concept */}
                <View>
                  <Text className="text-[11px] font-bold text-sage mb-1">
                    {t(JOURNAL_CONSTANTS.CONCEPT_LABEL)} *
                  </Text>
                  <TextInput
                    value={concept}
                    onChangeText={setConcept}
                    placeholder={t(JOURNAL_CONSTANTS.CONCEPT_PLACEHOLDER)}
                    placeholderTextColor="#9AA5A1"
                    className="rounded-xl border border-[#DCEBE2] bg-[#F9FCFA] px-3.5 py-2.5 text-sm text-pine"
                  />
                </View>

                {/* Total amount calculated banner */}
                <View className="rounded-2xl bg-[#E8F5EE] p-3.5 border border-[#C5E6D4] flex-row items-center justify-between">
                  <View>
                    <Text className="text-[11px] font-bold text-sage">
                      {t(JOURNAL_CONSTANTS.TOTAL_AMOUNT_LABEL)}
                    </Text>
                    <Text className="text-xl font-extrabold text-pine">
                      {activeHousehold?.currency ?? 'BOB'} {computedTotalAmount.toFixed(2)}
                    </Text>
                  </View>
                  <View className="rounded-full bg-pine/10 px-3 py-1">
                    <Text className="text-xs font-bold text-pine">
                      {items.length} {items.length === 1 ? 'ítem' : 'ítems'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Section 2: Items & Categories */}
              <View className="rounded-3xl bg-white p-4 border border-[#E2EFE8] gap-3">
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-xs font-extrabold uppercase tracking-wider text-pine">
                      {t(JOURNAL_CONSTANTS.ITEMS_SECTION_TITLE)}
                    </Text>
                  </View>
                  <Pressable
                    onPress={handleAddItem}
                    className="flex-row items-center rounded-full bg-[#D6F2E4] px-3 py-1.5 active:bg-[#BEE8D2]"
                  >
                    <Ionicons name="add" size={15} color="#0B3D2E" />
                    <Text className="ml-1 text-xs font-bold text-pine">
                      {t(JOURNAL_CONSTANTS.ADD_ITEM)}
                    </Text>
                  </Pressable>
                </View>

                {items.map((item, index) => (
                  <View
                    key={item.id}
                    className="rounded-2xl bg-[#F4FAF6] p-3.5 border border-[#DCEBE2] gap-2.5"
                  >
                    <View className="flex-row items-center justify-between">
                      <Text className="text-xs font-extrabold text-pine">
                        {t(JOURNAL_CONSTANTS.ITEM_NUMBER, { num: index + 1 })}
                      </Text>
                      {items.length > 1 ? (
                        <Pressable onPress={() => handleRemoveItem(item.id)}>
                          <Ionicons name="trash-outline" size={16} color="#DC2626" />
                        </Pressable>
                      ) : null}
                    </View>

                    {/* Category Selection */}
                    {txType === 'expense' && budgetTypes.length > 0 ? (
                      <View>
                        <Text className="text-[10px] font-bold text-sage mb-1">
                          {t(JOURNAL_CONSTANTS.ITEM_CATEGORY_LABEL)}
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          <View className="flex-row gap-1.5">
                            {budgetTypes.map((bt) => {
                              const catKey = bt.category_key || bt.id;
                              const isSelected =
                                item.category === catKey || item.category === bt.id;
                              return (
                                <Pressable
                                  key={bt.id}
                                  onPress={() => handleUpdateItem(item.id, 'category', catKey)}
                                  className={`rounded-full px-3 py-1 border ${
                                    isSelected
                                      ? 'bg-pine border-pine'
                                      : 'bg-white border-[#DCEBE2]'
                                  }`}
                                >
                                  <Text
                                    className={`text-[11px] font-bold ${
                                      isSelected ? 'text-white' : 'text-pine'
                                    }`}
                                  >
                                    {bt.name}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </ScrollView>
                      </View>
                    ) : null}

                    {/* Amount & Item Concept */}
                    <View className="flex-row gap-2">
                      <View className="w-28">
                        <Text className="text-[10px] font-bold text-sage mb-1">
                          {t(JOURNAL_CONSTANTS.ITEM_AMOUNT_LABEL)}
                        </Text>
                        <TextInput
                          value={item.amount}
                          onChangeText={(v) => handleUpdateItem(item.id, 'amount', v)}
                          keyboardType="decimal-pad"
                          placeholder="0.00"
                          placeholderTextColor="#9AA5A1"
                          className="rounded-xl border border-[#DCEBE2] bg-white px-3 py-2 text-xs font-bold text-pine"
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="text-[10px] font-bold text-sage mb-1">
                          {t(COMMON_CONSTANTS.DESCRIPTION)}
                        </Text>
                        <TextInput
                          value={item.concept}
                          onChangeText={(v) => handleUpdateItem(item.id, 'concept', v)}
                          placeholder={
                            items.length === 1
                              ? concept.trim() || t(JOURNAL_CONSTANTS.DESCRIPTION_PLACEHOLDER)
                              : t(JOURNAL_CONSTANTS.DESCRIPTION_PLACEHOLDER)
                          }
                          placeholderTextColor="#9AA5A1"
                          className="rounded-xl border border-[#DCEBE2] bg-white px-3 py-2 text-xs text-pine"
                        />
                      </View>
                    </View>
                  </View>
                ))}
              </View>

              {/* Optional Advanced / Reference section */}
              <Pressable
                onPress={() => setShowAdvanced((prev) => !prev)}
                className="flex-row items-center justify-between py-1 px-1"
              >
                <Text className="text-xs font-bold text-sage">
                  {showAdvanced
                    ? '− Menos opciones'
                    : '+ Más opciones (referencia, comprobante)'}
                </Text>
              </Pressable>

              {showAdvanced ? (
                <View className="rounded-2xl bg-white p-3.5 border border-[#E2EFE8] gap-3">
                  <View>
                    <Text className="text-[11px] font-bold text-sage mb-1">
                      {t(JOURNAL_CONSTANTS.PAYMENT_METHOD_LABEL)}
                    </Text>
                    <TextInput
                      value={externalReference}
                      onChangeText={setExternalReference}
                      placeholder="Ej. Varios recibos de fin de semana, Débito Nido..."
                      placeholderTextColor="#9AA5A1"
                      className="rounded-xl border border-[#DCEBE2] bg-[#F9FCFA] px-3.5 py-2 text-xs text-pine"
                    />
                  </View>
                  <View>
                    <Text className="text-[11px] font-bold text-sage mb-1">
                      {t(JOURNAL_CONSTANTS.OPERATION_CODE_LABEL)}
                    </Text>
                    <TextInput
                      value={operationCode}
                      onChangeText={setOperationCode}
                      placeholder="OP-MULTI-04"
                      placeholderTextColor="#9AA5A1"
                      className="rounded-xl border border-[#DCEBE2] bg-[#F9FCFA] px-3.5 py-2 text-xs text-pine"
                    />
                  </View>
                </View>
              ) : null}

              {formError ? (
                <View className="rounded-2xl bg-red-50 p-3.5 border border-red-200">
                  <Text className="text-xs font-bold text-red-700">{formError}</Text>
                </View>
              ) : null}

              {formSuccess ? (
                <View className="rounded-2xl bg-emerald-50 p-3.5 border border-emerald-200">
                  <Text className="text-xs font-bold text-emerald-800">{formSuccess}</Text>
                </View>
              ) : null}

              {/* Submit Action */}
              <Pressable
                onPress={() => void handleSaveTransaction()}
                disabled={saving}
                className="flex-row items-center justify-center rounded-2xl bg-pine py-4 shadow-sm active:bg-pine-dark disabled:opacity-60"
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
                    <Text className="ml-2 text-base font-extrabold text-white">
                      {t(JOURNAL_CONSTANTS.SAVE_BUTTON)} ({activeHousehold?.currency ?? 'BOB'}{' '}
                      {computedTotalAmount.toFixed(2)})
                    </Text>
                  </>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

