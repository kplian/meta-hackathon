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
import type { AccountTypeRow } from '../lib/budget-schema';
import { ACCOUNT_TYPES_CONSTANTS, COMMON_CONSTANTS } from '../i18n/constants';

interface AccountTypesViewProps {
  currentUserId: string;
}

const NORMAL_BALANCE_OPTIONS = ['debit', 'credit'] as const;

export default function AccountTypesView({ currentUserId }: AccountTypesViewProps) {
  const { t } = useTranslation();
  const [items, setItems] = useState<AccountTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Create / Edit modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AccountTypeRow | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [normalBalance, setNormalBalance] = useState<'debit' | 'credit'>('debit');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Logical Delete confirmation modal state
  const [itemToDelete, setItemToDelete] = useState<AccountTypeRow | null>(null);
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

  // Load active non-deleted account types
  const loadAccountTypes = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .schema('budget')
        .from('taccount_type')
        .select('*')
        .is('deleted_at', null)
        .order('name', { ascending: true });

      setItems(data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAccountTypes();
  }, []);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        item.normal_balance.toLowerCase().includes(q),
    );
  }, [items, searchQuery]);

  // Open Create modal
  const handleOpenCreate = () => {
    setEditingItem(null);
    setCode('');
    setName('');
    setNormalBalance('debit');
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open Edit modal pre-populated with selected record
  const handleOpenEdit = (item: AccountTypeRow) => {
    setEditingItem(item);
    setCode(item.code);
    setName(item.name);
    setNormalBalance(item.normal_balance === 'credit' ? 'credit' : 'debit');
    setFormError(null);
    setIsModalOpen(true);
  };

  // Save Account Type (Create or Update)
  const handleSave = async () => {
    setFormError(null);
    if (!code.trim()) {
      setFormError(t(ACCOUNT_TYPES_CONSTANTS.ERR_CODE_REQUIRED));
      return;
    }
    if (!name.trim()) {
      setFormError(t(ACCOUNT_TYPES_CONSTANTS.ERR_NAME_REQUIRED));
      return;
    }

    setSaving(true);
    try {
      const actorId = await resolveActorUserId();

      if (editingItem) {
        const { error } = await supabase
          .schema('budget')
          .from('taccount_type')
          .update({
            code: code.trim().toLowerCase(),
            name: name.trim(),
            normal_balance: normalBalance,
            updated_at: new Date().toISOString(),
            updated_by: actorId,
          })
          .eq('id', editingItem.id);

        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .schema('budget')
          .from('taccount_type')
          .insert({
            code: code.trim().toLowerCase(),
            name: name.trim(),
            normal_balance: normalBalance,
            status: 'active',
            created_by: actorId,
          });

        if (error) throw new Error(error.message);
      }

      setIsModalOpen(false);
      await loadAccountTypes();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar el tipo de cuenta');
    } finally {
      setSaving(false);
    }
  };

  // Confirm logical deletion (updates deleted_at and deleted_by)
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const actorId = await resolveActorUserId();
      const { error } = await supabase
        .schema('budget')
        .from('taccount_type')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: actorId,
          status: 'inactive',
        })
        .eq('id', itemToDelete.id);

      if (error) throw new Error(error.message);

      setItemToDelete(null);
      await loadAccountTypes();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'No se pudo eliminar el registro');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View className="relative flex-1 bg-[#F2F8F4]">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pt-3 pb-28 max-w-5xl w-full self-center"
      >
        {/* Top Header Pill */}
        <View className="mb-3 flex-row items-center justify-between">
          <View className="flex-row items-center rounded-full bg-[#DCECE3] px-4 py-2">
            <Ionicons name="card-outline" size={16} color="#0B3D2E" />
            <Text className="ml-2 text-[13px] font-bold text-pine">
              {t(ACCOUNT_TYPES_CONSTANTS.TITLE)} ({items.length})
            </Text>
          </View>

          <View className="rounded-full bg-[#E6F4EC] px-3 py-1">
            <Text className="text-[11px] font-extrabold text-pine">budget.taccount_type</Text>
          </View>
        </View>

        {/* Search Input + Refresh Button */}
        <View className="flex-row items-center gap-2.5 mb-4">
          <View className="flex-1 flex-row items-center rounded-2xl bg-white px-4 py-3 shadow-sm border border-[#E5F0EA]">
            <Ionicons name="search-outline" size={20} color="#7A8C83" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t(ACCOUNT_TYPES_CONSTANTS.SEARCH_PLACEHOLDER)}
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
            onPress={() => void loadAccountTypes()}
            className="h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm border border-[#E5F0EA] active:bg-[#E8F4ED]"
            accessibilityLabel={t(COMMON_CONSTANTS.REFRESH)}
          >
            <Ionicons name="refresh" size={20} color="#0B3D2E" />
          </Pressable>
        </View>

        {/* Cards List (Journal Card Style) */}
        {loading ? (
          <View className="py-10 items-center">
            <ActivityIndicator size="large" color="#0B3D2E" />
          </View>
        ) : filteredItems.length === 0 ? (
          <View className="mt-3 items-center rounded-3xl bg-white p-8 shadow-sm border border-[#E5F0EA]">
            <Ionicons name="card-outline" size={36} color="#9BA8A2" />
            <Text className="mt-3 text-[15px] font-bold text-[#12211B]">
              {t(ACCOUNT_TYPES_CONSTANTS.EMPTY_TITLE)}
            </Text>
            <Text className="mt-1 text-center text-[13px] text-[#5A6D64]">
              {t(ACCOUNT_TYPES_CONSTANTS.EMPTY_DESC)}
            </Text>
          </View>
        ) : (
          <View className="gap-2.5">
            {filteredItems.map((item) => {
              const isDebit = item.normal_balance === 'debit';
              const badgeStyle = isDebit
                ? 'bg-[#DFF5E8] text-[#0B3D2E]'
                : 'bg-[#FDE6D5] text-[#8E3B10]';

              return (
                <View
                  key={item.id}
                  className="flex-row items-center justify-between rounded-3xl bg-white px-4 py-3.5 shadow-sm border border-[#E7F1EC]"
                >
                  {/* Left Circular Icon + Info */}
                  <View className="flex-row items-center flex-1 mr-2">
                    <View
                      className="h-12 w-12 items-center justify-center rounded-full"
                      style={{ backgroundColor: isDebit ? '#E6F4EC' : '#FFF1E6' }}
                    >
                      <Ionicons
                        name="card-outline"
                        size={22}
                        color={isDebit ? '#0B3D2E' : '#9A4B1A'}
                      />
                    </View>

                    <View className="ml-3 flex-1">
                      <View className="flex-row items-center flex-wrap gap-1.5">
                        <Text
                          className="text-[15px] font-extrabold text-[#12211B]"
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>
                        <View className={`rounded-full px-2.5 py-0.5 ${badgeStyle}`}>
                          <Text className="text-[10px] font-extrabold uppercase">
                            {item.normal_balance}
                          </Text>
                        </View>
                      </View>

                      <View className="mt-1 flex-row items-center">
                        <View className="h-4 w-4 items-center justify-center rounded-full bg-[#D9EBE0]">
                          <Text className="text-[8px] font-extrabold text-pine">
                            {(item.code[0] ?? 'A').toUpperCase()}
                          </Text>
                        </View>
                        <Text
                          className="ml-1.5 text-[12px] font-medium text-[#5A6D64]"
                          numberOfLines={1}
                        >
                          {t(COMMON_CONSTANTS.CODE)}: {item.code} • {item.status ?? 'active'}
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
                        setItemToDelete(item);
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
        accessibilityLabel={t(ACCOUNT_TYPES_CONSTANTS.NEW_TITLE)}
      >
        <Ionicons name="add" size={32} color="#FFFFFF" />
      </Pressable>

      {/* Create / Edit Modal */}
      <Modal
        visible={isModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsModalOpen(false)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="max-h-[88%] rounded-t-3xl bg-[#F4FAF6] px-5 pt-5 pb-8">
            <View className="flex-row items-center justify-between pb-3 border-b border-[#DCECE3]">
              <View>
                <Text className="text-[11px] font-extrabold uppercase tracking-wider text-sage">
                  budget.taccount_type
                </Text>
                <Text className="text-xl font-extrabold text-pine">
                  {editingItem
                    ? t(ACCOUNT_TYPES_CONSTANTS.EDIT_TITLE)
                    : t(ACCOUNT_TYPES_CONSTANTS.NEW_TITLE)}
                </Text>
              </View>
              <Pressable
                onPress={() => setIsModalOpen(false)}
                className="h-9 w-9 items-center justify-center rounded-full bg-[#E2EFE8]"
              >
                <Ionicons name="close" size={20} color="#0B3D2E" />
              </Pressable>
            </View>

            <ScrollView className="mt-4" contentContainerClassName="gap-3.5 pb-4">
              <View>
                <Text className="mb-1 text-xs font-bold text-[#3B4F46]">
                  {t(COMMON_CONSTANTS.CODE)} (code) *
                </Text>
                <TextInput
                  value={code}
                  onChangeText={setCode}
                  autoCapitalize="none"
                  placeholder="asset, liability, equity, income, expense"
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
                  placeholder="Asset"
                  placeholderTextColor="#8FA198"
                  className="rounded-xl bg-white px-3.5 py-2.5 text-sm text-[#12211B] border border-[#DCECE3]"
                />
              </View>

              <View>
                <Text className="mb-1.5 text-xs font-bold text-[#3B4F46]">
                  {t(ACCOUNT_TYPES_CONSTANTS.NORMAL_BALANCE_LABEL)}
                </Text>
                <View className="flex-row gap-2">
                  {NORMAL_BALANCE_OPTIONS.map((opt) => {
                    const active = normalBalance === opt;
                    return (
                      <Pressable
                        key={opt}
                        onPress={() => setNormalBalance(opt)}
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
                      {editingItem
                        ? t(COMMON_CONSTANTS.SAVE_CHANGES)
                        : t(ACCOUNT_TYPES_CONSTANTS.CREATE_BTN)}
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
        visible={Boolean(itemToDelete)}
        animationType="fade"
        transparent
        onRequestClose={() => setItemToDelete(null)}
      >
        <View className="flex-1 items-center justify-center bg-black/40 px-5">
          <View className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-[#FFF5F5] self-center">
              <Feather name="trash-2" size={22} color="#C53030" />
            </View>
            <Text className="mt-3 text-center text-lg font-extrabold text-[#12211B]">
              {t(ACCOUNT_TYPES_CONSTANTS.DELETE_TITLE)}
            </Text>
            <Text className="mt-1.5 text-center text-[13px] text-[#5A6D64]">
              <Text className="font-bold text-[#12211B]">{itemToDelete?.name}</Text> —{' '}
              {t(COMMON_CONSTANTS.LOGICAL_DELETE_DESC)}
            </Text>

            {deleteError ? (
              <View className="mt-3 rounded-xl bg-red-50 p-3">
                <Text className="text-xs font-bold text-red-700">{deleteError}</Text>
              </View>
            ) : null}

            <View className="mt-5 flex-row gap-2.5">
              <Pressable
                onPress={() => setItemToDelete(null)}
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

