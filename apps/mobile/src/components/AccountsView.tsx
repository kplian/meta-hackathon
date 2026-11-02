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
import type {
  AccountRow,
  AccountTypeRow,
  AuxiliarTypeRow,
  BusinessTypeRow,
} from '../lib/budget-schema';
import { ACCOUNTS_CONSTANTS, COMMON_CONSTANTS } from '../i18n/constants';

interface AccountsViewProps {
  currentUserId: string;
}

interface AccountTreeNode {
  account: AccountRow;
  children: AccountTreeNode[];
  depth: number;
}

const CURRENCY_OPTIONS = ['BOB', 'USD', 'CLP', 'EUR'] as const;

export default function AccountsView({ currentUserId }: AccountsViewProps) {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [businessTypes, setBusinessTypes] = useState<BusinessTypeRow[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountTypeRow[]>([]);
  const [auxiliarTypes, setAuxiliarTypes] = useState<AuxiliarTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Top filter dropdown by business_type_id
  const [selectedBusinessTypeFilter, setSelectedBusinessTypeFilter] = useState<string>('ALL');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);

  // Expanded state for tree nodes (by account.id)
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Record<string, boolean>>({});

  // Create / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountRow | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('BOB');
  const [businessTypeId, setBusinessTypeId] = useState<string>('');
  const [accountTypeId, setAccountTypeId] = useState<string>('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [requiredAuxiliarTypeId, setRequiredAuxiliarTypeId] = useState<string | null>(null);
  const [requiresAuxiliar, setRequiresAuxiliar] = useState<boolean>(false);
  const [isPostable, setIsPostable] = useState<boolean>(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Dropdown open states inside the Create/Edit Modal
  const [openDropdown, setOpenDropdown] = useState<
    'business_type' | 'parent' | 'account_type' | 'auxiliar_type' | null
  >(null);

  // Logical Delete confirmation modal state
  const [accountToDelete, setAccountToDelete] = useState<AccountRow | null>(null);
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

  // Load accounts and catalog tables (tbusiness_type, taccount_type, tauxiliar_type)
  const loadAccountsData = async () => {
    setLoading(true);
    try {
      const [accRes, btRes, atRes, auxTypeRes] = await Promise.all([
        supabase
          .schema('budget')
          .from('taccount')
          .select('*')
          .is('deleted_at', null)
          .is('household_id', null)
          .order('code', { ascending: true }),
        supabase
          .schema('budget')
          .from('tbusiness_type')
          .select('*')
          .is('deleted_at', null)
          .order('name', { ascending: true }),
        supabase
          .schema('budget')
          .from('taccount_type')
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

      setAccounts(accRes.data ?? []);
      setBusinessTypes(btRes.data ?? []);
      setAccountTypes(atRes.data ?? []);
      setAuxiliarTypes(auxTypeRes.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAccountsData();
  }, []);

  // Maps for quick label lookups
  const businessTypeMap = useMemo(
    () => new Map(businessTypes.map((b) => [b.id, b])),
    [businessTypes],
  );
  const accountTypeMap = useMemo(
    () => new Map(accountTypes.map((a) => [a.id, a])),
    [accountTypes],
  );
  const auxiliarTypeMap = useMemo(
    () => new Map(auxiliarTypes.map((x) => [x.id, x])),
    [auxiliarTypes],
  );
  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts],
  );

  // Filter accounts by business_type_id and search query (excluding any household-specific accounts)
  const visibleAccounts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return accounts.filter((acc) => {
      // Exclude records where household_id is not null
      if (acc.household_id !== null && acc.household_id !== undefined) {
        return false;
      }
      if (
        selectedBusinessTypeFilter !== 'ALL' &&
        acc.business_type_id !== selectedBusinessTypeFilter
      ) {
        return false;
      }
      if (!q) return true;
      const btName = (acc.business_type_id && businessTypeMap.get(acc.business_type_id)?.name) || '';
      const atName = accountTypeMap.get(acc.account_type_id)?.name || '';
      return (
        acc.code.toLowerCase().includes(q) ||
        acc.name.toLowerCase().includes(q) ||
        btName.toLowerCase().includes(q) ||
        atName.toLowerCase().includes(q)
      );
    });
  }, [accounts, selectedBusinessTypeFilter, searchQuery, businessTypeMap, accountTypeMap]);

  // Build hierarchical tree structure using id and parent_id
  const treeRoots = useMemo(() => {
    const visibleSet = new Set(visibleAccounts.map((a) => a.id));
    const childrenByParent = new Map<string | null, AccountRow[]>();

    for (const acc of visibleAccounts) {
      // If parent is null or parent is not in visibleSet, treat as a root in current view
      const effectiveParentId =
        acc.parent_id && visibleSet.has(acc.parent_id) ? acc.parent_id : null;
      const list = childrenByParent.get(effectiveParentId) ?? [];
      list.push(acc);
      childrenByParent.set(effectiveParentId, list);
    }

    const buildNodes = (parentKey: string | null, depth: number, visited: Set<string>): AccountTreeNode[] => {
      const rows = childrenByParent.get(parentKey) ?? [];
      return rows
        .filter((row) => !visited.has(row.id))
        .map((row) => {
          const nextVisited = new Set(visited);
          nextVisited.add(row.id);
          return {
            account: row,
            depth,
            children: buildNodes(row.id, depth + 1, nextVisited),
          };
        });
    };

    return buildNodes(null, 0, new Set());
  }, [visibleAccounts]);

  // Collect all descendant IDs of a given account (to prevent circular parent selection when editing)
  const getDescendantIds = (rootId: string): Set<string> => {
    const descendants = new Set<string>();
    const stack = [rootId];
    while (stack.length > 0) {
      const current = stack.pop()!;
      for (const acc of accounts) {
        if (acc.parent_id === current && !descendants.has(acc.id)) {
          descendants.add(acc.id);
          stack.push(acc.id);
        }
      }
    }
    return descendants;
  };

  // Toggle collapse/expand of a node
  const toggleCollapseNode = (nodeId: string) => {
    setCollapsedNodeIds((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  };

  // Open Create modal for a Root account (parent_id = null)
  const handleOpenCreateRoot = () => {
    setEditingAccount(null);
    setCode('');
    setName('');
    setCurrency('BOB');
    setBusinessTypeId(
      selectedBusinessTypeFilter !== 'ALL'
        ? selectedBusinessTypeFilter
        : businessTypes[0]?.id ?? '',
    );
    setAccountTypeId(accountTypes[0]?.id ?? '');
    setParentId(null);
    setRequiredAuxiliarTypeId(null);
    setRequiresAuxiliar(false);
    setIsPostable(true);
    setOpenDropdown(null);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open Create modal for a Child/Branch account under a specific parent node
  const handleOpenCreateChild = (parentAccount: AccountRow) => {
    setEditingAccount(null);
    setCode(`${parentAccount.code}.`);
    setName('');
    setCurrency(parentAccount.currency?.trim() || 'BOB');
    setBusinessTypeId(parentAccount.business_type_id ?? businessTypes[0]?.id ?? '');
    setAccountTypeId(parentAccount.account_type_id);
    setParentId(parentAccount.id);
    setRequiredAuxiliarTypeId(parentAccount.required_auxiliar_type_id ?? null);
    setRequiresAuxiliar(parentAccount.requires_auxiliar);
    setIsPostable(true);
    setOpenDropdown(null);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open Edit modal pre-filled with account data
  const handleOpenEdit = (account: AccountRow) => {
    setEditingAccount(account);
    setCode(account.code);
    setName(account.name);
    setCurrency(account.currency?.trim() || 'BOB');
    setBusinessTypeId(account.business_type_id ?? businessTypes[0]?.id ?? '');
    setAccountTypeId(account.account_type_id);
    setParentId(account.parent_id ?? null);
    setRequiredAuxiliarTypeId(account.required_auxiliar_type_id ?? null);
    setRequiresAuxiliar(account.requires_auxiliar);
    setIsPostable(account.is_postable);
    setOpenDropdown(null);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Save Account (Create or Update without household_id)
  const handleSave = async () => {
    setFormError(null);
    if (!code.trim()) {
      setFormError(t(ACCOUNTS_CONSTANTS.ERR_CODE_REQUIRED));
      return;
    }
    if (!name.trim()) {
      setFormError(t(ACCOUNTS_CONSTANTS.ERR_NAME_REQUIRED));
      return;
    }
    if (!businessTypeId) {
      setFormError(t(ACCOUNTS_CONSTANTS.ERR_BUSINESS_TYPE_REQUIRED));
      return;
    }
    if (!accountTypeId) {
      setFormError(t(ACCOUNTS_CONSTANTS.ERR_ACCOUNT_TYPE_REQUIRED));
      return;
    }

    setSaving(true);
    try {
      const actorId = await resolveActorUserId();

      if (editingAccount) {
        const { error } = await supabase
          .schema('budget')
          .from('taccount')
          .update({
            code: code.trim(),
            name: name.trim(),
            currency: currency.trim() || 'BOB',
            business_type_id: businessTypeId,
            account_type_id: accountTypeId,
            parent_id: parentId || null,
            required_auxiliar_type_id: requiredAuxiliarTypeId || null,
            requires_auxiliar: requiresAuxiliar,
            is_postable: isPostable,
            updated_at: new Date().toISOString(),
            updated_by: actorId,
          })
          .eq('id', editingAccount.id);

        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .schema('budget')
          .from('taccount')
          .insert({
            code: code.trim(),
            name: name.trim(),
            currency: currency.trim() || 'BOB',
            business_type_id: businessTypeId,
            account_type_id: accountTypeId,
            parent_id: parentId || null,
            required_auxiliar_type_id: requiredAuxiliarTypeId || null,
            requires_auxiliar: requiresAuxiliar,
            is_postable: isPostable,
            status: 'active',
            created_by: actorId,
          });

        if (error) throw new Error(error.message);
      }

      setIsModalOpen(false);
      await loadAccountsData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar la cuenta');
    } finally {
      setSaving(false);
    }
  };

  // Confirm Logical Delete (updates deleted_at and deleted_by)
  const handleConfirmDelete = async () => {
    if (!accountToDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const actorId = await resolveActorUserId();
      const { error } = await supabase
        .schema('budget')
        .from('taccount')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: actorId,
          status: 'inactive',
        })
        .eq('id', accountToDelete.id);

      if (error) throw new Error(error.message);

      setAccountToDelete(null);
      await loadAccountsData();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'No se pudo eliminar la cuenta');
    } finally {
      setDeleting(false);
    }
  };

  // Recursive renderer for a tree node and its children
  const renderTreeNode = (node: AccountTreeNode): React.ReactNode => {
    const { account, children, depth } = node;
    const hasChildren = children.length > 0;
    const isCollapsed = Boolean(collapsedNodeIds[account.id]);
    const accountType = accountTypeMap.get(account.account_type_id);
    const businessType = account.business_type_id
      ? businessTypeMap.get(account.business_type_id)
      : undefined;
    const auxType = account.required_auxiliar_type_id
      ? auxiliarTypeMap.get(account.required_auxiliar_type_id)
      : undefined;
    const parentAcc = account.parent_id ? accountMap.get(account.parent_id) : undefined;

    return (
      <View key={account.id} className="mb-2.5">
        {/* Node Card with indentation corresponding to tree depth */}
        <View
          style={{ marginLeft: Math.min(depth * 22, 88) }}
          className="flex-row items-center justify-between rounded-3xl bg-white px-4 py-3.5 shadow-sm border border-[#E7F1EC]"
        >
          {/* Left Tree Connector + Expand Button + Circular Icon + Account Info */}
          <View className="flex-row items-center flex-1 mr-2">
            {depth > 0 ? (
              <View className="mr-1.5 flex-row items-center">
                <MaterialCommunityIcons
                  name="subdirectory-arrow-right"
                  size={16}
                  color="#7A8C83"
                />
              </View>
            ) : null}

            {hasChildren ? (
              <Pressable
                onPress={() => toggleCollapseNode(account.id)}
                className="mr-2 h-7 w-7 items-center justify-center rounded-full bg-[#E6F4EC] active:bg-[#CDE6D8]"
                accessibilityLabel={isCollapsed ? 'Expandir subcuentas' : 'Contraer subcuentas'}
              >
                <Ionicons
                  name={isCollapsed ? 'chevron-forward' : 'chevron-down'}
                  size={15}
                  color="#0B3D2E"
                />
              </Pressable>
            ) : null}

            <View
              className="h-11 w-11 items-center justify-center rounded-full"
              style={{
                backgroundColor: depth === 0 ? '#E6F4EC' : '#F0F7F3',
              }}
            >
              <MaterialCommunityIcons
                name={hasChildren ? 'file-tree-outline' : 'bank-outline'}
                size={21}
                color="#0B3D2E"
              />
            </View>

            <View className="ml-3 flex-1">
              <View className="flex-row items-center flex-wrap gap-1.5">
                <View className="rounded-lg bg-[#0B3D2E] px-2 py-0.5">
                  <Text className="text-[11px] font-extrabold text-white">{account.code}</Text>
                </View>

                <Text
                  className="text-[15px] font-extrabold text-[#12211B]"
                  numberOfLines={1}
                >
                  {account.name}
                </Text>

                {accountType ? (
                  <View className="rounded-full bg-[#DFF5E8] px-2.5 py-0.5">
                    <Text className="text-[10px] font-extrabold text-[#0B3D2E]">
                      {accountType.name}
                    </Text>
                  </View>
                ) : null}

                {businessType ? (
                  <View className="rounded-full bg-[#E3ECE7] px-2.5 py-0.5">
                    <Text className="text-[10px] font-bold text-[#3B4F46]">
                      {businessType.name}
                    </Text>
                  </View>
                ) : null}

                {hasChildren ? (
                  <View className="rounded-full bg-[#FFF1E6] px-2 py-0.5">
                    <Text className="text-[10px] font-extrabold text-[#9A4B1A]">
                      {children.length}{' '}
                      {children.length === 1
                        ? t(ACCOUNTS_CONSTANTS.BRANCH_SINGULAR)
                        : t(ACCOUNTS_CONSTANTS.BRANCH_PLURAL)}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View className="mt-1 flex-row items-center flex-wrap">
                <Text className="text-[12px] font-medium text-[#5A6D64]" numberOfLines={1}>
                  {depth === 0 && !parentAcc
                    ? t(ACCOUNTS_CONSTANTS.ROOT_NODE)
                    : `${t(ACCOUNTS_CONSTANTS.PARENT_PREFIX)} ${parentAcc?.code ?? ''} ${parentAcc?.name ?? ''}`}
                  {' • '}
                  {account.currency?.trim() || 'BOB'}
                  {' • '}
                  {account.is_postable
                    ? t(ACCOUNTS_CONSTANTS.POSTABLE_LABEL)
                    : t(ACCOUNTS_CONSTANTS.GROUP_ACCOUNT_LABEL)}
                  {auxType ? ` • Aux: ${auxType.name}` : ''}
                </Text>
              </View>
            </View>
          </View>

          {/* Right Flat Action Icons: Add Child Branch (+), Edit, Delete */}
          <View className="flex-row items-center gap-1.5">
            <Pressable
              onPress={() => handleOpenCreateChild(account)}
              className="h-9 w-9 items-center justify-center rounded-full bg-[#E6F4EC] active:bg-[#CDE6D8]"
              accessibilityLabel={t(ACCOUNTS_CONSTANTS.NEW_BRANCH_TITLE)}
            >
              <Ionicons name="git-branch-outline" size={16} color="#0B3D2E" />
            </Pressable>

            <Pressable
              onPress={() => handleOpenEdit(account)}
              className="h-9 w-9 items-center justify-center rounded-full bg-[#F2F8F4] active:bg-[#DCECE3]"
              accessibilityLabel={t(COMMON_CONSTANTS.EDIT)}
            >
              <Feather name="edit-2" size={16} color="#0B3D2E" />
            </Pressable>

            <Pressable
              onPress={() => {
                setDeleteError(null);
                setAccountToDelete(account);
              }}
              className="h-9 w-9 items-center justify-center rounded-full bg-[#FFF5F5] active:bg-[#FED7D7]"
              accessibilityLabel={t(COMMON_CONSTANTS.DELETE)}
            >
              <Feather name="trash-2" size={16} color="#C53030" />
            </Pressable>
          </View>
        </View>

        {/* Render Children Branches Recursively if not collapsed */}
        {hasChildren && !isCollapsed ? (
          <View className="mt-2">
            {children.map((childNode) => renderTreeNode(childNode))}
          </View>
        ) : null}
      </View>
    );
  };

  // Candidate parent accounts for the modal dropdown (excluding self and own descendants when editing)
  const availableParentAccounts = useMemo(() => {
    const excludedIds = editingAccount ? getDescendantIds(editingAccount.id) : new Set<string>();
    if (editingAccount) excludedIds.add(editingAccount.id);

    return accounts.filter((acc) => {
      if (excludedIds.has(acc.id)) return false;
      if (businessTypeId && acc.business_type_id && acc.business_type_id !== businessTypeId) {
        return false;
      }
      return true;
    });
  }, [accounts, editingAccount, businessTypeId]);

  const selectedFilterBtLabel =
    selectedBusinessTypeFilter === 'ALL'
      ? t(ACCOUNTS_CONSTANTS.ALL_BUSINESS_TYPES)
      : businessTypeMap.get(selectedBusinessTypeFilter)?.name ?? 'Business Type';

  const selectedModalBtLabel =
    businessTypeMap.get(businessTypeId)?.name ?? t(ACCOUNTS_CONSTANTS.BUSINESS_TYPE_LABEL);
  const selectedModalAtLabel =
    accountTypeMap.get(accountTypeId)?.name ?? t(ACCOUNTS_CONSTANTS.ACCOUNT_TYPE_LABEL);
  const selectedModalParent = parentId ? accountMap.get(parentId) : null;
  const selectedModalAuxType = requiredAuxiliarTypeId
    ? auxiliarTypeMap.get(requiredAuxiliarTypeId)
    : null;

  return (
    <View className="relative flex-1 bg-[#F2F8F4]">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pt-3 pb-28 max-w-5xl w-full self-center"
      >
        {/* Top Bar: Business Type Filter Dropdown + Create Root Button */}
        <View className="mb-3 flex-row items-center justify-between flex-wrap gap-2">
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => setIsFilterDropdownOpen((prev) => !prev)}
              className="flex-row items-center rounded-full bg-[#DCECE3] px-4 py-2 active:bg-[#CBE2D5]"
            >
              <MaterialCommunityIcons name="storefront-outline" size={16} color="#0B3D2E" />
              <Text className="ml-2 mr-1.5 text-[13px] font-bold text-pine">
                {selectedFilterBtLabel}
              </Text>
              <Ionicons
                name={isFilterDropdownOpen ? 'chevron-up' : 'chevron-down'}
                size={15}
                color="#0B3D2E"
              />
            </Pressable>

            <Pressable
              onPress={handleOpenCreateRoot}
              className="flex-row items-center rounded-full bg-pine px-3.5 py-2 active:opacity-90"
            >
              <Ionicons name="add-circle-outline" size={15} color="#FFFFFF" />
              <Text className="ml-1.5 text-[12px] font-extrabold text-white">
                {t(ACCOUNTS_CONSTANTS.NEW_ROOT_BTN)}
              </Text>
            </Pressable>
          </View>

          <View className="rounded-full bg-[#E6F4EC] px-3 py-1">
            <Text className="text-[11px] font-extrabold text-pine">
              budget.taccount • {visibleAccounts.length} {t(ACCOUNTS_CONSTANTS.ACCOUNTS_COUNT)}
            </Text>
          </View>
        </View>

        {/* Business Type Filter Dropdown Menu */}
        {isFilterDropdownOpen ? (
          <View className="mb-3 rounded-2xl bg-white p-2 shadow-md border border-[#DCECE3]">
            <Pressable
              onPress={() => {
                setSelectedBusinessTypeFilter('ALL');
                setIsFilterDropdownOpen(false);
              }}
              className={`flex-row items-center justify-between rounded-xl px-3.5 py-2.5 ${
                selectedBusinessTypeFilter === 'ALL' ? 'bg-[#E6F4EC]' : 'bg-transparent'
              }`}
            >
              <Text className="text-xs font-extrabold text-pine">
                {t(ACCOUNTS_CONSTANTS.ALL_BUSINESS_TYPES)}
              </Text>
              {selectedBusinessTypeFilter === 'ALL' ? (
                <Ionicons name="checkmark-circle" size={16} color="#0B3D2E" />
              ) : null}
            </Pressable>

            {businessTypes.map((bt) => {
              const isSelected = selectedBusinessTypeFilter === bt.id;
              return (
                <Pressable
                  key={bt.id}
                  onPress={() => {
                    setSelectedBusinessTypeFilter(bt.id);
                    setIsFilterDropdownOpen(false);
                  }}
                  className={`flex-row items-center justify-between rounded-xl px-3.5 py-2.5 ${
                    isSelected ? 'bg-[#E6F4EC]' : 'bg-transparent'
                  }`}
                >
                  <View>
                    <Text className="text-xs font-extrabold text-pine">{bt.name}</Text>
                    <Text className="text-[10px] text-[#5A6D64]">
                      {t(COMMON_CONSTANTS.CODE)}: {bt.code}
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

        {/* Search Input + Expand/Collapse All + Refresh */}
        <View className="flex-row items-center gap-2 mb-4">
          <View className="flex-1 flex-row items-center rounded-2xl bg-white px-4 py-3 shadow-sm border border-[#E5F0EA]">
            <Ionicons name="search-outline" size={20} color="#7A8C83" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t(ACCOUNTS_CONSTANTS.SEARCH_PLACEHOLDER)}
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
            onPress={() => setCollapsedNodeIds({})}
            className="h-12 px-3 items-center justify-center rounded-2xl bg-white shadow-sm border border-[#E5F0EA] active:bg-[#E8F4ED]"
            accessibilityLabel={t(COMMON_CONSTANTS.EXPAND)}
          >
            <Text className="text-[11px] font-extrabold text-pine">
              {t(COMMON_CONSTANTS.EXPAND)}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => void loadAccountsData()}
            className="h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm border border-[#E5F0EA] active:bg-[#E8F4ED]"
            accessibilityLabel={t(COMMON_CONSTANTS.REFRESH)}
          >
            <Ionicons name="refresh" size={20} color="#0B3D2E" />
          </Pressable>
        </View>

        {/* Hierarchical Tree View */}
        {loading ? (
          <View className="py-10 items-center">
            <ActivityIndicator size="large" color="#0B3D2E" />
          </View>
        ) : treeRoots.length === 0 ? (
          <View className="mt-3 items-center rounded-3xl bg-white p-8 shadow-sm border border-[#E5F0EA]">
            <MaterialCommunityIcons name="file-tree-outline" size={38} color="#9BA8A2" />
            <Text className="mt-3 text-[15px] font-bold text-[#12211B]">
              {t(ACCOUNTS_CONSTANTS.EMPTY_TITLE)}
            </Text>
            <Text className="mt-1 text-center text-[13px] text-[#5A6D64]">
              {t(ACCOUNTS_CONSTANTS.EMPTY_DESC)}
            </Text>
          </View>
        ) : (
          <View>{treeRoots.map((rootNode) => renderTreeNode(rootNode))}</View>
        )}
      </ScrollView>

      {/* Fixed Floating Action Button (+) at bottom-right */}
      <Pressable
        onPress={handleOpenCreateRoot}
        className="absolute bottom-5 right-5 h-16 w-16 items-center justify-center rounded-full bg-pine shadow-lg active:bg-pine-dark"
        accessibilityLabel={t(ACCOUNTS_CONSTANTS.NEW_ROOT_TITLE)}
      >
        <Ionicons name="add" size={32} color="#FFFFFF" />
      </Pressable>

      {/* Create / Edit Account Modal */}
      <Modal
        visible={isModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsModalOpen(false)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="max-h-[92%] rounded-t-3xl bg-[#F4FAF6] px-5 pt-5 pb-8">
            <View className="flex-row items-center justify-between pb-3 border-b border-[#DCECE3]">
              <View>
                <Text className="text-[11px] font-extrabold uppercase tracking-wider text-sage">
                  budget.taccount •{' '}
                  {parentId
                    ? t(ACCOUNTS_CONSTANTS.NEW_BRANCH_TITLE)
                    : t(ACCOUNTS_CONSTANTS.ROOT_NODE)}
                </Text>
                <Text className="text-xl font-extrabold text-pine">
                  {editingAccount
                    ? t(ACCOUNTS_CONSTANTS.EDIT_TITLE)
                    : parentId
                      ? t(ACCOUNTS_CONSTANTS.NEW_BRANCH_TITLE)
                      : t(ACCOUNTS_CONSTANTS.NEW_ROOT_TITLE)}
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
              {/* 1. Business Type Dropdown (from budget.tbusiness_type) */}
              <View>
                <Text className="mb-1 text-xs font-bold text-[#3B4F46]">
                  {t(ACCOUNTS_CONSTANTS.BUSINESS_TYPE_LABEL)}
                </Text>
                <Pressable
                  onPress={() =>
                    setOpenDropdown((prev) =>
                      prev === 'business_type' ? null : 'business_type',
                    )
                  }
                  className="flex-row items-center justify-between rounded-xl bg-white px-3.5 py-3 border border-[#DCECE3]"
                >
                  <Text className="text-sm font-bold text-[#12211B]">
                    {selectedModalBtLabel}
                  </Text>
                  <Ionicons
                    name={openDropdown === 'business_type' ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color="#0B3D2E"
                  />
                </Pressable>

                {openDropdown === 'business_type' ? (
                  <View className="mt-1.5 rounded-xl bg-white p-1.5 border border-[#DCECE3]">
                    {businessTypes.map((bt) => {
                      const selected = businessTypeId === bt.id;
                      return (
                        <Pressable
                          key={bt.id}
                          onPress={() => {
                            setBusinessTypeId(bt.id);
                            setOpenDropdown(null);
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

              {/* 2. Parent Account Dropdown (Root vs Branch in budget.taccount) */}
              <View>
                <Text className="mb-1 text-xs font-bold text-[#3B4F46]">
                  {t(ACCOUNTS_CONSTANTS.PARENT_ACCOUNT_LABEL)}
                </Text>
                <Pressable
                  onPress={() =>
                    setOpenDropdown((prev) => (prev === 'parent' ? null : 'parent'))
                  }
                  className="flex-row items-center justify-between rounded-xl bg-white px-3.5 py-3 border border-[#DCECE3]"
                >
                  <Text className="text-sm font-bold text-[#12211B]">
                    {selectedModalParent
                      ? `${selectedModalParent.code} — ${selectedModalParent.name}`
                      : t(ACCOUNTS_CONSTANTS.NONE_ROOT_OPTION)}
                  </Text>
                  <Ionicons
                    name={openDropdown === 'parent' ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color="#0B3D2E"
                  />
                </Pressable>

                {openDropdown === 'parent' ? (
                  <View className="mt-1.5 max-h-48 rounded-xl bg-white p-1.5 border border-[#DCECE3]">
                    <ScrollView nestedScrollEnabled>
                      <Pressable
                        onPress={() => {
                          setParentId(null);
                          setOpenDropdown(null);
                        }}
                        className={`flex-row items-center justify-between rounded-lg px-3 py-2 ${
                          parentId === null ? 'bg-[#E6F4EC]' : 'bg-transparent'
                        }`}
                      >
                        <Text className="text-xs font-extrabold text-pine">
                          {t(ACCOUNTS_CONSTANTS.NONE_ROOT_OPTION)}
                        </Text>
                        {parentId === null ? (
                          <Ionicons name="checkmark-circle" size={16} color="#0B3D2E" />
                        ) : null}
                      </Pressable>

                      {availableParentAccounts.map((acc) => {
                        const selected = parentId === acc.id;
                        return (
                          <Pressable
                            key={acc.id}
                            onPress={() => {
                              setParentId(acc.id);
                              setAccountTypeId(acc.account_type_id);
                              if (acc.business_type_id) {
                                setBusinessTypeId(acc.business_type_id);
                              }
                              setOpenDropdown(null);
                            }}
                            className={`flex-row items-center justify-between rounded-lg px-3 py-2 ${
                              selected ? 'bg-[#E6F4EC]' : 'bg-transparent'
                            }`}
                          >
                            <Text className="text-xs font-bold text-[#12211B]">
                              {acc.code} — {acc.name}
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

              {/* 3. Account Type Dropdown (budget.taccount_type) */}
              <View>
                <Text className="mb-1 text-xs font-bold text-[#3B4F46]">
                  {t(ACCOUNTS_CONSTANTS.ACCOUNT_TYPE_LABEL)}
                </Text>
                <Pressable
                  onPress={() =>
                    setOpenDropdown((prev) =>
                      prev === 'account_type' ? null : 'account_type',
                    )
                  }
                  className="flex-row items-center justify-between rounded-xl bg-white px-3.5 py-3 border border-[#DCECE3]"
                >
                  <Text className="text-sm font-bold text-[#12211B]">
                    {selectedModalAtLabel}
                  </Text>
                  <Ionicons
                    name={openDropdown === 'account_type' ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color="#0B3D2E"
                  />
                </Pressable>

                {openDropdown === 'account_type' ? (
                  <View className="mt-1.5 rounded-xl bg-white p-1.5 border border-[#DCECE3]">
                    {accountTypes.map((at) => {
                      const selected = accountTypeId === at.id;
                      return (
                        <Pressable
                          key={at.id}
                          onPress={() => {
                            setAccountTypeId(at.id);
                            setOpenDropdown(null);
                          }}
                          className={`flex-row items-center justify-between rounded-lg px-3 py-2 ${
                            selected ? 'bg-[#E6F4EC]' : 'bg-transparent'
                          }`}
                        >
                          <Text className="text-xs font-bold text-pine">
                            {at.name} ({at.normal_balance})
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

              {/* 4. Code & Name */}
              <View className="flex-row gap-2.5">
                <View className="w-32">
                  <Text className="mb-1 text-xs font-bold text-[#3B4F46]">
                    {t(COMMON_CONSTANTS.CODE)} (code) *
                  </Text>
                  <TextInput
                    value={code}
                    onChangeText={setCode}
                    placeholder="110.01"
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
                    placeholder="Cash / Bank"
                    placeholderTextColor="#8FA198"
                    className="rounded-xl bg-white px-3.5 py-2.5 text-sm text-[#12211B] border border-[#DCECE3]"
                  />
                </View>
              </View>

              {/* 5. Currency & Postable / Requires Auxiliar toggles */}
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
                        className={`flex-1 items-center rounded-xl py-2 border ${
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

              {/* 6. Required Auxiliar Type Dropdown (optional) */}
              <View>
                <Text className="mb-1 text-xs font-bold text-[#3B4F46]">
                  {t(ACCOUNTS_CONSTANTS.REQUIRED_AUX_TYPE_LABEL)}
                </Text>
                <Pressable
                  onPress={() =>
                    setOpenDropdown((prev) =>
                      prev === 'auxiliar_type' ? null : 'auxiliar_type',
                    )
                  }
                  className="flex-row items-center justify-between rounded-xl bg-white px-3.5 py-3 border border-[#DCECE3]"
                >
                  <Text className="text-sm font-bold text-[#12211B]">
                    {selectedModalAuxType
                      ? `${selectedModalAuxType.name} (${selectedModalAuxType.code})`
                      : t(COMMON_CONSTANTS.NONE)}
                  </Text>
                  <Ionicons
                    name={openDropdown === 'auxiliar_type' ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color="#0B3D2E"
                  />
                </Pressable>

                {openDropdown === 'auxiliar_type' ? (
                  <View className="mt-1.5 rounded-xl bg-white p-1.5 border border-[#DCECE3]">
                    <Pressable
                      onPress={() => {
                        setRequiredAuxiliarTypeId(null);
                        setRequiresAuxiliar(false);
                        setOpenDropdown(null);
                      }}
                      className={`flex-row items-center justify-between rounded-lg px-3 py-2 ${
                        requiredAuxiliarTypeId === null ? 'bg-[#E6F4EC]' : 'bg-transparent'
                      }`}
                    >
                      <Text className="text-xs font-bold text-pine">
                        {t(COMMON_CONSTANTS.NONE)}
                      </Text>
                      {requiredAuxiliarTypeId === null ? (
                        <Ionicons name="checkmark-circle" size={16} color="#0B3D2E" />
                      ) : null}
                    </Pressable>

                    {auxiliarTypes.map((aux) => {
                      const selected = requiredAuxiliarTypeId === aux.id;
                      return (
                        <Pressable
                          key={aux.id}
                          onPress={() => {
                            setRequiredAuxiliarTypeId(aux.id);
                            setRequiresAuxiliar(true);
                            setOpenDropdown(null);
                          }}
                          className={`flex-row items-center justify-between rounded-lg px-3 py-2 ${
                            selected ? 'bg-[#E6F4EC]' : 'bg-transparent'
                          }`}
                        >
                          <Text className="text-xs font-bold text-pine">
                            {aux.name} ({aux.code})
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

              {/* Boolean Flags: is_postable & requires_auxiliar */}
              <View className="flex-row gap-2.5">
                <Pressable
                  onPress={() => setIsPostable((v) => !v)}
                  className={`flex-1 flex-row items-center justify-between rounded-xl px-3.5 py-3 border ${
                    isPostable ? 'bg-[#E6F4EC] border-pine' : 'bg-white border-[#DCECE3]'
                  }`}
                >
                  <Text className="text-xs font-bold text-[#12211B]">
                    {t(ACCOUNTS_CONSTANTS.POSTABLE_LABEL)}
                  </Text>
                  <Ionicons
                    name={isPostable ? 'checkbox' : 'square-outline'}
                    size={18}
                    color="#0B3D2E"
                  />
                </Pressable>

                <Pressable
                  onPress={() => setRequiresAuxiliar((v) => !v)}
                  className={`flex-1 flex-row items-center justify-between rounded-xl px-3.5 py-3 border ${
                    requiresAuxiliar ? 'bg-[#E6F4EC] border-pine' : 'bg-white border-[#DCECE3]'
                  }`}
                >
                  <Text className="text-xs font-bold text-[#12211B]">
                    {t(ACCOUNTS_CONSTANTS.REQUIRES_AUX_LABEL)}
                  </Text>
                  <Ionicons
                    name={requiresAuxiliar ? 'checkbox' : 'square-outline'}
                    size={18}
                    color="#0B3D2E"
                  />
                </Pressable>
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
                      {editingAccount
                        ? t(COMMON_CONSTANTS.SAVE_CHANGES)
                        : t(ACCOUNTS_CONSTANTS.CREATE_BTN)}
                    </Text>
                  </>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Confirm Logical Delete Modal */}
      <Modal
        visible={Boolean(accountToDelete)}
        animationType="fade"
        transparent
        onRequestClose={() => setAccountToDelete(null)}
      >
        <View className="flex-1 items-center justify-center bg-black/40 px-5">
          <View className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-[#FFF5F5] self-center">
              <Feather name="trash-2" size={22} color="#C53030" />
            </View>
            <Text className="mt-3 text-center text-lg font-extrabold text-[#12211B]">
              {t(ACCOUNTS_CONSTANTS.DELETE_TITLE)}
            </Text>
            <Text className="mt-1.5 text-center text-[13px] text-[#5A6D64]">
              <Text className="font-bold text-[#12211B]">
                {accountToDelete?.code} — {accountToDelete?.name}
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
                onPress={() => setAccountToDelete(null)}
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

