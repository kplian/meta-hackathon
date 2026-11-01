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
import type { ChannelRow, UserRow } from '../lib/budget-schema';
import { COMMON_CONSTANTS, USERS_CONSTANTS } from '../i18n/constants';

interface UsersViewProps {
  currentUserId: string;
  onUsersChanged?: (count: number) => void;
}

const ROLE_OPTIONS = ['admin', 'member'] as const;
const LOCALE_OPTIONS = ['es', 'en', 'pt'] as const;
const TIMEZONE_OPTIONS = ['UTC', 'America/La_Paz', 'America/Santiago', 'America/Lima'] as const;
const CHANNEL_TYPE_OPTIONS = ['whatsapp', 'telegram'] as const;

export default function UsersView({ currentUserId, onUsersChanged }: UsersViewProps) {
  const { t } = useTranslation();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [channelCounts, setChannelCounts] = useState<Record<string, number>>({});
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Create / Edit User modal state
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [fullName, setFullName] = useState('');
  const [emailUser, setEmailUser] = useState('');
  const [role, setRole] = useState<string>('member');
  const [locale, setLocale] = useState<string>('es');
  const [timezone, setTimezone] = useState<string>('UTC');
  const [status, setStatus] = useState<string>('active');
  const [savingUser, setSavingUser] = useState(false);
  const [userFormError, setUserFormError] = useState<string | null>(null);

  // Logical Delete User confirmation modal state
  const [userToDelete, setUserToDelete] = useState<UserRow | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);
  const [deleteUserError, setDeleteUserError] = useState<string | null>(null);

  // Channels sub-view state for a selected user
  const [selectedUserForChannels, setSelectedUserForChannels] = useState<UserRow | null>(null);
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [channelSearchQuery, setChannelSearchQuery] = useState('');

  // Create / Edit Channel modal state
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<ChannelRow | null>(null);
  const [channelType, setChannelType] = useState<'whatsapp' | 'telegram'>('whatsapp');
  const [channelCode, setChannelCode] = useState('');
  const [configJson, setConfigJson] = useState('');
  const [channelStatus, setChannelStatus] = useState<string>('active');
  const [savingChannel, setSavingChannel] = useState(false);
  const [channelFormError, setChannelFormError] = useState<string | null>(null);

  // Logical Delete Channel confirmation modal state
  const [channelToDelete, setChannelToDelete] = useState<ChannelRow | null>(null);
  const [deletingChannel, setDeletingChannel] = useState(false);
  const [deleteChannelError, setDeleteChannelError] = useState<string | null>(null);

  // Ensure the current authenticated user exists in budget.tuser for foreign key audit columns
  const resolveActorUserId = async (): Promise<string | null> => {
    const found = users.find((u) => u.id === currentUserId);
    if (found) return found.id;
    const { data } = await supabase
      .schema('budget')
      .from('tuser')
      .select('id')
      .eq('id', currentUserId)
      .maybeSingle();
    return data?.id ?? users[0]?.id ?? null;
  };

  // Load active non-deleted users and channel counts
  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const [usersRes, channelsRes] = await Promise.all([
        supabase
          .schema('budget')
          .from('tuser')
          .select('*')
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
        supabase
          .schema('budget')
          .from('tchannel')
          .select('id, user_id')
          .is('deleted_at', null),
      ]);

      if (usersRes.data) {
        setUsers(usersRes.data);
        onUsersChanged?.(usersRes.data.length);
      }

      if (channelsRes.data) {
        const counts: Record<string, number> = {};
        for (const ch of channelsRes.data) {
          if (ch.user_id) {
            counts[ch.user_id] = (counts[ch.user_id] ?? 0) + 1;
          }
        }
        setChannelCounts(counts);
      }
    } finally {
      setLoadingUsers(false);
    }
  };

  // Load active non-deleted channels for a specific user
  const loadUserChannels = async (targetUserId: string) => {
    setLoadingChannels(true);
    try {
      const { data } = await supabase
        .schema('budget')
        .from('tchannel')
        .select('*')
        .eq('user_id', targetUserId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      const list = data ?? [];
      setChannels(list);
      setChannelCounts((prev) => ({
        ...prev,
        [targetUserId]: list.length,
      }));
    } finally {
      setLoadingChannels(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  useEffect(() => {
    if (selectedUserForChannels) {
      void loadUserChannels(selectedUserForChannels.id);
    }
  }, [selectedUserForChannels?.id]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.full_name.toLowerCase().includes(q) ||
        u.email_user.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q),
    );
  }, [users, searchQuery]);

  // Filtered channels
  const filteredChannels = useMemo(() => {
    const q = channelSearchQuery.trim().toLowerCase();
    if (!q) return channels;
    return channels.filter(
      (c) =>
        c.channel_code.toLowerCase().includes(q) ||
        (c.channel_type ?? '').toLowerCase().includes(q) ||
        (c.config_json ?? '').toLowerCase().includes(q),
    );
  }, [channels, channelSearchQuery]);

  // Open Create User modal
  const handleOpenCreateUser = () => {
    setEditingUser(null);
    setFullName('');
    setEmailUser('');
    setRole('member');
    setLocale('es');
    setTimezone('UTC');
    setStatus('active');
    setUserFormError(null);
    setIsUserModalOpen(true);
  };

  // Open Edit User modal with existing user data
  const handleOpenEditUser = (user: UserRow) => {
    setEditingUser(user);
    setFullName(user.full_name);
    setEmailUser(user.email_user);
    setRole(user.role || 'member');
    setLocale(user.locale || 'es');
    setTimezone(user.timezone || 'UTC');
    setStatus(user.status || 'active');
    setUserFormError(null);
    setIsUserModalOpen(true);
  };

  // Save User (Create or Update)
  const handleSaveUser = async () => {
    setUserFormError(null);
    if (!fullName.trim()) {
      setUserFormError(t(USERS_CONSTANTS.ERR_NAME_REQUIRED));
      return;
    }
    if (!emailUser.trim() || !emailUser.includes('@')) {
      setUserFormError(t(USERS_CONSTANTS.ERR_EMAIL_INVALID));
      return;
    }

    setSavingUser(true);
    try {
      const actorId = await resolveActorUserId();

      if (editingUser) {
        const { error } = await supabase
          .schema('budget')
          .from('tuser')
          .update({
            full_name: fullName.trim(),
            email_user: emailUser.trim().toLowerCase(),
            role,
            locale,
            timezone,
            status,
            updated_at: new Date().toISOString(),
            updated_by: actorId,
          })
          .eq('id', editingUser.id);

        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .schema('budget')
          .from('tuser')
          .insert({
            full_name: fullName.trim(),
            email_user: emailUser.trim().toLowerCase(),
            role,
            locale,
            timezone,
            status,
            created_by: actorId,
          });

        if (error) throw new Error(error.message);
      }

      setIsUserModalOpen(false);
      await loadUsers();
    } catch (err) {
      setUserFormError(err instanceof Error ? err.message : 'Error al guardar el usuario');
    } finally {
      setSavingUser(false);
    }
  };

  // Confirm logical deletion of User (sets deleted_at and deleted_by)
  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    setDeletingUser(true);
    setDeleteUserError(null);
    try {
      const actorId = await resolveActorUserId();
      const { error } = await supabase
        .schema('budget')
        .from('tuser')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: actorId,
          status: 'inactive',
        })
        .eq('id', userToDelete.id);

      if (error) throw new Error(error.message);

      setUserToDelete(null);
      await loadUsers();
    } catch (err) {
      setDeleteUserError(err instanceof Error ? err.message : 'No se pudo eliminar el usuario');
    } finally {
      setDeletingUser(false);
    }
  };

  // Open Create Channel modal
  const handleOpenCreateChannel = () => {
    setEditingChannel(null);
    setChannelType('whatsapp');
    setChannelCode('');
    setConfigJson('{}');
    setChannelStatus('active');
    setChannelFormError(null);
    setIsChannelModalOpen(true);
  };

  // Open Edit Channel modal
  const handleOpenEditChannel = (channel: ChannelRow) => {
    setEditingChannel(channel);
    setChannelType(channel.channel_type === 'telegram' ? 'telegram' : 'whatsapp');
    setChannelCode(channel.channel_code);
    setConfigJson(channel.config_json ?? '{}');
    setChannelStatus(channel.status ?? 'active');
    setChannelFormError(null);
    setIsChannelModalOpen(true);
  };

  // Save Channel (Create or Update)
  const handleSaveChannel = async () => {
    if (!selectedUserForChannels) return;
    setChannelFormError(null);

    if (!channelCode.trim()) {
      setChannelFormError(t(USERS_CONSTANTS.ERR_CHANNEL_CODE_REQUIRED));
      return;
    }

    setSavingChannel(true);
    try {
      const actorId = await resolveActorUserId();

      if (editingChannel) {
        const { error } = await supabase
          .schema('budget')
          .from('tchannel')
          .update({
            channel_type: channelType,
            channel_code: channelCode.trim(),
            config_json: configJson.trim() || null,
            status: channelStatus,
            updated_at: new Date().toISOString(),
            updated_by: actorId,
          })
          .eq('id', editingChannel.id);

        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .schema('budget')
          .from('tchannel')
          .insert({
            user_id: selectedUserForChannels.id,
            channel_type: channelType,
            channel_code: channelCode.trim(),
            config_json: configJson.trim() || null,
            status: channelStatus,
            created_by: actorId,
          });

        if (error) throw new Error(error.message);
      }

      setIsChannelModalOpen(false);
      await loadUserChannels(selectedUserForChannels.id);
    } catch (err) {
      setChannelFormError(err instanceof Error ? err.message : 'Error al guardar el canal');
    } finally {
      setSavingChannel(false);
    }
  };

  // Confirm logical deletion of Channel (sets deleted_at and deleted_by)
  const handleConfirmDeleteChannel = async () => {
    if (!channelToDelete || !selectedUserForChannels) return;
    setDeletingChannel(true);
    setDeleteChannelError(null);
    try {
      const actorId = await resolveActorUserId();
      const { error } = await supabase
        .schema('budget')
        .from('tchannel')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: actorId,
          status: 'inactive',
        })
        .eq('id', channelToDelete.id);

      if (error) throw new Error(error.message);

      setChannelToDelete(null);
      await loadUserChannels(selectedUserForChannels.id);
    } catch (err) {
      setDeleteChannelError(err instanceof Error ? err.message : 'No se pudo eliminar el canal');
    } finally {
      setDeletingChannel(false);
    }
  };

  // ============================================================================
  // CHANNELS INTERFACE FOR SELECTED USER
  // ============================================================================
  if (selectedUserForChannels) {
    return (
      <View className="relative flex-1 bg-[#F2F8F4]">
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-4 pt-3 pb-28 max-w-5xl w-full self-center"
        >
          {/* Back Navigation + User Context Header */}
          <View className="mb-3 flex-row items-center justify-between">
            <Pressable
              onPress={() => {
                setSelectedUserForChannels(null);
                setChannelSearchQuery('');
              }}
              className="flex-row items-center rounded-full bg-[#DCECE3] px-3.5 py-2 active:bg-[#CBE2D5]"
            >
              <Ionicons name="arrow-back" size={16} color="#0B3D2E" />
              <Text className="ml-1.5 text-[13px] font-bold text-pine">
                {t(USERS_CONSTANTS.BACK_TO_USERS)}
              </Text>
            </Pressable>

            <View className="rounded-full bg-[#E6F4EC] px-3 py-1">
              <Text className="text-[11px] font-extrabold text-pine">
                budget.tchannel • {channels.length}{' '}
                {channels.length === 1
                  ? t(USERS_CONSTANTS.CHANNEL_SINGULAR)
                  : t(USERS_CONSTANTS.CHANNEL_PLURAL)}
              </Text>
            </View>
          </View>

          {/* Selected User Summary Banner */}
          <View className="mb-4 rounded-3xl bg-white p-4 shadow-sm border border-[#E5F0EA] flex-row items-center justify-between">
            <View className="flex-row items-center flex-1">
              <View className="h-11 w-11 items-center justify-center rounded-full bg-pine">
                <Text className="text-sm font-extrabold text-white">
                  {(selectedUserForChannels.full_name[0] ?? 'U').toUpperCase()}
                </Text>
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-[11px] font-extrabold uppercase tracking-wider text-[#5A6D64]">
                  {t(USERS_CONSTANTS.USER_CHANNELS_HEADER)}
                </Text>
                <Text className="text-[16px] font-extrabold text-[#12211B]" numberOfLines={1}>
                  {selectedUserForChannels.full_name}
                </Text>
                <Text className="text-[12px] text-[#5A6D64]" numberOfLines={1}>
                  {selectedUserForChannels.email_user}
                </Text>
              </View>
            </View>
          </View>

          {/* Search Input + Refresh */}
          <View className="flex-row items-center gap-2.5 mb-4">
            <View className="flex-1 flex-row items-center rounded-2xl bg-white px-4 py-3 shadow-sm border border-[#E5F0EA]">
              <Ionicons name="search-outline" size={20} color="#7A8C83" />
              <TextInput
                value={channelSearchQuery}
                onChangeText={setChannelSearchQuery}
                placeholder={t(USERS_CONSTANTS.SEARCH_CHANNEL_PLACEHOLDER)}
                placeholderTextColor="#7A8C83"
                className="ml-2.5 flex-1 text-[15px] text-pine"
              />
              {channelSearchQuery ? (
                <Pressable onPress={() => setChannelSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color="#9BA8A2" />
                </Pressable>
              ) : null}
            </View>

            <Pressable
              onPress={() => void loadUserChannels(selectedUserForChannels.id)}
              className="h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm border border-[#E5F0EA] active:bg-[#E8F4ED]"
              accessibilityLabel={t(COMMON_CONSTANTS.REFRESH)}
            >
              <Ionicons name="refresh" size={20} color="#0B3D2E" />
            </Pressable>
          </View>

          {/* Channel Cards List */}
          {loadingChannels ? (
            <View className="py-10 items-center">
              <ActivityIndicator size="large" color="#0B3D2E" />
            </View>
          ) : filteredChannels.length === 0 ? (
            <View className="mt-2 items-center rounded-3xl bg-white p-8 shadow-sm border border-[#E5F0EA]">
              <Ionicons name="chatbubbles-outline" size={36} color="#9BA8A2" />
              <Text className="mt-3 text-[15px] font-bold text-[#12211B]">
                {t(USERS_CONSTANTS.EMPTY_CHANNELS_TITLE)}
              </Text>
              <Text className="mt-1 text-center text-[13px] text-[#5A6D64]">
                {t(USERS_CONSTANTS.EMPTY_CHANNELS_DESC)}
              </Text>
            </View>
          ) : (
            <View className="gap-2.5">
              {filteredChannels.map((ch) => {
                const isWhatsapp = ch.channel_type !== 'telegram';
                const badgeStyle = isWhatsapp
                  ? 'bg-[#DFF5E8] text-[#0B3D2E]'
                  : 'bg-[#E0F2FE] text-[#0369A1]';

                return (
                  <View
                    key={ch.id}
                    className="flex-row items-center justify-between rounded-3xl bg-white px-4 py-3.5 shadow-sm border border-[#E7F1EC]"
                  >
                    {/* Left Icon + Channel Info (Journal Card style) */}
                    <View className="flex-row items-center flex-1 mr-2">
                      <View
                        className="h-12 w-12 items-center justify-center rounded-full"
                        style={{ backgroundColor: isWhatsapp ? '#E6F4EC' : '#E0F2FE' }}
                      >
                        <Ionicons
                          name={isWhatsapp ? 'logo-whatsapp' : 'paper-plane-outline'}
                          size={22}
                          color={isWhatsapp ? '#0B3D2E' : '#0369A1'}
                        />
                      </View>

                      <View className="ml-3 flex-1">
                        <View className="flex-row items-center flex-wrap gap-1.5">
                          <Text
                            className="text-[15px] font-extrabold text-[#12211B]"
                            numberOfLines={1}
                          >
                            {ch.channel_code}
                          </Text>
                          <View className={`rounded-full px-2.5 py-0.5 ${badgeStyle}`}>
                            <Text className="text-[10px] font-extrabold uppercase">
                              {ch.channel_type ?? 'whatsapp'}
                            </Text>
                          </View>
                          {ch.status && ch.status !== 'active' ? (
                            <View className="rounded-full bg-[#FDE6D5] px-2 py-0.5">
                              <Text className="text-[10px] font-bold text-[#8E3B10]">
                                {ch.status}
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        <View className="mt-1 flex-row items-center">
                          <View className="h-4 w-4 items-center justify-center rounded-full bg-[#D9EBE0]">
                            <Text className="text-[8px] font-extrabold text-pine">
                              {(selectedUserForChannels.full_name[0] ?? 'U').toUpperCase()}
                            </Text>
                          </View>
                          <Text
                            className="ml-1.5 text-[12px] font-medium text-[#5A6D64]"
                            numberOfLines={1}
                          >
                            {selectedUserForChannels.full_name}
                            {ch.config_json ? ` • ${ch.config_json}` : ''}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Right Flat Action Icons: Edit & Delete */}
                    <View className="flex-row items-center gap-1.5">
                      <Pressable
                        onPress={() => handleOpenEditChannel(ch)}
                        className="h-9 w-9 items-center justify-center rounded-full bg-[#F2F8F4] active:bg-[#DCECE3]"
                        accessibilityLabel={t(COMMON_CONSTANTS.EDIT)}
                      >
                        <Feather name="edit-2" size={16} color="#0B3D2E" />
                      </Pressable>

                      <Pressable
                        onPress={() => {
                          setDeleteChannelError(null);
                          setChannelToDelete(ch);
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

        {/* Fixed Floating Action Button (+) for New Channel */}
        <Pressable
          onPress={handleOpenCreateChannel}
          className="absolute bottom-5 right-5 h-16 w-16 items-center justify-center rounded-full bg-pine shadow-lg active:bg-pine-dark"
          accessibilityLabel={t(USERS_CONSTANTS.NEW_CHANNEL_TITLE)}
        >
          <Ionicons name="add" size={32} color="#FFFFFF" />
        </Pressable>

        {/* Create / Edit Channel Modal */}
        <Modal
          visible={isChannelModalOpen}
          animationType="slide"
          transparent
          onRequestClose={() => setIsChannelModalOpen(false)}
        >
          <View className="flex-1 justify-end bg-black/40">
            <View className="max-h-[88%] rounded-t-3xl bg-[#F4FAF6] px-5 pt-5 pb-8">
              <View className="flex-row items-center justify-between pb-3 border-b border-[#DCECE3]">
                <View>
                  <Text className="text-[11px] font-extrabold uppercase tracking-wider text-sage">
                    budget.tchannel
                  </Text>
                  <Text className="text-xl font-extrabold text-pine">
                    {editingChannel
                      ? t(USERS_CONSTANTS.EDIT_CHANNEL_TITLE)
                      : t(USERS_CONSTANTS.NEW_CHANNEL_TITLE)}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setIsChannelModalOpen(false)}
                  className="h-9 w-9 items-center justify-center rounded-full bg-[#E2EFE8]"
                >
                  <Ionicons name="close" size={20} color="#0B3D2E" />
                </Pressable>
              </View>

              <ScrollView className="mt-4" contentContainerClassName="gap-3.5 pb-4">
                <View>
                  <Text className="mb-1.5 text-xs font-bold text-[#3B4F46]">
                    {t(USERS_CONSTANTS.CHANNEL_TYPE_LABEL)}
                  </Text>
                  <View className="flex-row gap-2">
                    {CHANNEL_TYPE_OPTIONS.map((opt) => {
                      const active = channelType === opt;
                      return (
                        <Pressable
                          key={opt}
                          onPress={() => setChannelType(opt)}
                          className={`flex-1 flex-row items-center justify-center rounded-2xl py-3 border ${active
                              ? 'bg-pine border-pine'
                              : 'bg-white border-[#DCECE3]'
                            }`}
                        >
                          <Ionicons
                            name={opt === 'whatsapp' ? 'logo-whatsapp' : 'paper-plane-outline'}
                            size={16}
                            color={active ? '#FFFFFF' : '#0B3D2E'}
                          />
                          <Text
                            className={`ml-2 text-xs font-extrabold uppercase ${active ? 'text-white' : 'text-pine'
                              }`}
                          >
                            {opt}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View>
                  <Text className="mb-1 text-xs font-bold text-[#3B4F46]">
                    {t(USERS_CONSTANTS.CHANNEL_CODE_LABEL)}
                  </Text>
                  <TextInput
                    value={channelCode}
                    onChangeText={setChannelCode}
                    placeholder="+59170012345 / @user"
                    placeholderTextColor="#8FA198"
                    className="rounded-xl bg-white px-3.5 py-2.5 text-sm text-[#12211B] border border-[#DCECE3]"
                  />
                </View>

                <View>
                  <Text className="mb-1 text-xs font-bold text-[#3B4F46]">
                    {t(USERS_CONSTANTS.CONFIG_JSON_LABEL)}
                  </Text>
                  <TextInput
                    value={configJson}
                    onChangeText={setConfigJson}
                    placeholder='{"notifications": true}'
                    placeholderTextColor="#8FA198"
                    className="rounded-xl bg-white px-3.5 py-2.5 text-sm text-[#12211B] border border-[#DCECE3]"
                  />
                </View>

                {channelFormError ? (
                  <View className="rounded-2xl bg-red-50 p-3 border border-red-200">
                    <Text className="text-xs font-bold text-red-700">{channelFormError}</Text>
                  </View>
                ) : null}

                <Pressable
                  onPress={() => void handleSaveChannel()}
                  disabled={savingChannel}
                  className="mt-2 flex-row items-center justify-center rounded-2xl bg-pine py-4 shadow-md active:opacity-90 disabled:opacity-50"
                >
                  {savingChannel ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
                      <Text className="ml-2 text-sm font-extrabold text-white">
                        {editingChannel
                          ? t(COMMON_CONSTANTS.SAVE_CHANGES)
                          : t(USERS_CONSTANTS.CREATE_CHANNEL_BTN)}
                      </Text>
                    </>
                  )}
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Confirm Logical Delete Channel Modal */}
        <Modal
          visible={Boolean(channelToDelete)}
          animationType="fade"
          transparent
          onRequestClose={() => setChannelToDelete(null)}
        >
          <View className="flex-1 items-center justify-center bg-black/40 px-5">
            <View className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
              <View className="h-12 w-12 items-center justify-center rounded-full bg-[#FFF5F5] self-center">
                <Feather name="trash-2" size={22} color="#C53030" />
              </View>
              <Text className="mt-3 text-center text-lg font-extrabold text-[#12211B]">
                {t(USERS_CONSTANTS.DELETE_CHANNEL_TITLE)}
              </Text>
              <Text className="mt-1.5 text-center text-[13px] text-[#5A6D64]">
                <Text className="font-bold text-[#12211B]">{channelToDelete?.channel_code}</Text> —{' '}
                {t(COMMON_CONSTANTS.LOGICAL_DELETE_DESC)}
              </Text>

              {deleteChannelError ? (
                <View className="mt-3 rounded-xl bg-red-50 p-3">
                  <Text className="text-xs font-bold text-red-700">{deleteChannelError}</Text>
                </View>
              ) : null}

              <View className="mt-5 flex-row gap-2.5">
                <Pressable
                  onPress={() => setChannelToDelete(null)}
                  disabled={deletingChannel}
                  className="flex-1 items-center justify-center rounded-2xl bg-[#E8F4ED] py-3"
                >
                  <Text className="text-xs font-extrabold text-pine">
                    {t(COMMON_CONSTANTS.CANCEL)}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => void handleConfirmDeleteChannel()}
                  disabled={deletingChannel}
                  className="flex-1 items-center justify-center rounded-2xl bg-[#C53030] py-3"
                >
                  {deletingChannel ? (
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
  // MAIN USERS INTERFACE
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
            <Ionicons name="people-outline" size={16} color="#0B3D2E" />
            <Text className="ml-2 text-[13px] font-bold text-pine">
              {t(USERS_CONSTANTS.DIRECTORY_TITLE)} ({users.length})
            </Text>
          </View>

          <View className="rounded-full bg-[#E6F4EC] px-3 py-1">
            <Text className="text-[11px] font-extrabold text-pine">budget.tuser</Text>
          </View>
        </View>

        {/* Search Input + Refresh Button */}
        <View className="flex-row items-center gap-2.5 mb-4">
          <View className="flex-1 flex-row items-center rounded-2xl bg-white px-4 py-3 shadow-sm border border-[#E5F0EA]">
            <Ionicons name="search-outline" size={20} color="#7A8C83" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t(USERS_CONSTANTS.SEARCH_PLACEHOLDER)}
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
            onPress={() => void loadUsers()}
            className="h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm border border-[#E5F0EA] active:bg-[#E8F4ED]"
            accessibilityLabel={t(COMMON_CONSTANTS.REFRESH)}
          >
            <Ionicons name="refresh" size={20} color="#0B3D2E" />
          </Pressable>
        </View>

        {/* Users List in Journal Card Style */}
        {loadingUsers ? (
          <View className="py-10 items-center">
            <ActivityIndicator size="large" color="#0B3D2E" />
          </View>
        ) : filteredUsers.length === 0 ? (
          <View className="mt-3 items-center rounded-3xl bg-white p-8 shadow-sm border border-[#E5F0EA]">
            <Ionicons name="people-outline" size={36} color="#9BA8A2" />
            <Text className="mt-3 text-[15px] font-bold text-[#12211B]">
              {t(USERS_CONSTANTS.EMPTY_TITLE)}
            </Text>
            <Text className="mt-1 text-center text-[13px] text-[#5A6D64]">
              {t(USERS_CONSTANTS.EMPTY_DESC)}
            </Text>
          </View>
        ) : (
          <View className="gap-2.5">
            {filteredUsers.map((user) => {
              const isAdmin = user.role === 'admin';
              const badgeStyle = isAdmin
                ? 'bg-[#DFF5E8] text-[#0B3D2E]'
                : 'bg-[#E3ECE7] text-[#3B4F46]';
              const userChannelCount = channelCounts[user.id] ?? 0;

              return (
                <View
                  key={user.id}
                  className="flex-row items-center justify-between rounded-3xl bg-white px-4 py-3.5 shadow-sm border border-[#E7F1EC]"
                >
                  {/* Left Circular Icon + User Details (Journal Card style) */}
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
                          {user.full_name}
                        </Text>
                        <View className={`rounded-full px-2.5 py-0.5 ${badgeStyle}`}>
                          <Text className="text-[10px] font-extrabold">
                            {user.role}
                          </Text>
                        </View>
                        {userChannelCount > 0 ? (
                          <View className="rounded-full bg-[#E8F4ED] px-2 py-0.5">
                            <Text className="text-[10px] font-bold text-pine">
                              {userChannelCount}{' '}
                              {userChannelCount === 1
                                ? t(USERS_CONSTANTS.CHANNEL_SINGULAR)
                                : t(USERS_CONSTANTS.CHANNEL_PLURAL)}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      <View className="mt-1 flex-row items-center">
                        <View className="h-4 w-4 items-center justify-center rounded-full bg-[#D9EBE0]">
                          <Text className="text-[8px] font-extrabold text-pine">
                            {(user.full_name[0] ?? user.email_user[0] ?? 'U').toUpperCase()}
                          </Text>
                        </View>
                        <Text
                          className="ml-1.5 text-[12px] font-medium text-[#5A6D64]"
                          numberOfLines={1}
                        >
                          {user.email_user} • {user.locale.toUpperCase()} ({user.timezone})
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Right Flat Action Icons: Channels, Edit, Delete */}
                  <View className="flex-row items-center gap-1.5">
                    <Pressable
                      onPress={() => setSelectedUserForChannels(user)}
                      className="h-9 w-9 items-center justify-center rounded-full bg-[#E6F4EC] active:bg-[#CDE6D8]"
                      accessibilityLabel={t(USERS_CONSTANTS.USER_CHANNELS_HEADER)}
                    >
                      <MaterialCommunityIcons
                        name="message-processing-outline"
                        size={17}
                        color="#0B3D2E"
                      />
                    </Pressable>

                    <Pressable
                      onPress={() => handleOpenEditUser(user)}
                      className="h-9 w-9 items-center justify-center rounded-full bg-[#F2F8F4] active:bg-[#DCECE3]"
                      accessibilityLabel={t(COMMON_CONSTANTS.EDIT)}
                    >
                      <Feather name="edit-2" size={16} color="#0B3D2E" />
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        setDeleteUserError(null);
                        setUserToDelete(user);
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

      {/* Fixed Floating Action Button (+) at bottom-right (never moves on scroll) */}
      <Pressable
        onPress={handleOpenCreateUser}
        className="absolute bottom-5 right-5 h-16 w-16 items-center justify-center rounded-full bg-pine shadow-lg active:bg-pine-dark"
        accessibilityLabel={t(USERS_CONSTANTS.NEW_USER_TITLE)}
      >
        <Ionicons name="add" size={32} color="#FFFFFF" />
      </Pressable>

      {/* Create / Edit User Modal */}
      <Modal
        visible={isUserModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsUserModalOpen(false)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="max-h-[90%] rounded-t-3xl bg-[#F4FAF6] px-5 pt-5 pb-8">
            <View className="flex-row items-center justify-between pb-3 border-b border-[#DCECE3]">
              <View>
                <Text className="text-[11px] font-extrabold uppercase tracking-wider text-sage">
                  budget.tuser
                </Text>
                <Text className="text-xl font-extrabold text-pine">
                  {editingUser
                    ? t(USERS_CONSTANTS.EDIT_USER_TITLE)
                    : t(USERS_CONSTANTS.NEW_USER_TITLE)}
                </Text>
              </View>
              <Pressable
                onPress={() => setIsUserModalOpen(false)}
                className="h-9 w-9 items-center justify-center rounded-full bg-[#E2EFE8]"
              >
                <Ionicons name="close" size={20} color="#0B3D2E" />
              </Pressable>
            </View>

            <ScrollView className="mt-4" contentContainerClassName="gap-3.5 pb-4">
              <View>
                <Text className="mb-1 text-xs font-bold text-[#3B4F46]">
                  {t(USERS_CONSTANTS.FULL_NAME_LABEL)}
                </Text>
                <TextInput
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Valentina Smith"
                  placeholderTextColor="#8FA198"
                  className="rounded-xl bg-white px-3.5 py-2.5 text-sm text-[#12211B] border border-[#DCECE3]"
                />
              </View>

              <View>
                <Text className="mb-1 text-xs font-bold text-[#3B4F46]">
                  {t(USERS_CONSTANTS.EMAIL_LABEL)}
                </Text>
                <TextInput
                  value={emailUser}
                  onChangeText={setEmailUser}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="valentina@kplian.com"
                  placeholderTextColor="#8FA198"
                  className="rounded-xl bg-white px-3.5 py-2.5 text-sm text-[#12211B] border border-[#DCECE3]"
                />
              </View>

              <View>
                <Text className="mb-1.5 text-xs font-bold text-[#3B4F46]">
                  {t(COMMON_CONSTANTS.ROLE)}
                </Text>
                <View className="flex-row gap-2">
                  {ROLE_OPTIONS.map((r) => {
                    const active = role === r;
                    return (
                      <Pressable
                        key={r}
                        onPress={() => setRole(r)}
                        className={`flex-1 items-center rounded-xl py-2.5 border ${active ? 'bg-pine border-pine' : 'bg-white border-[#DCECE3]'
                          }`}
                      >
                        <Text
                          className={`text-xs font-extrabold uppercase ${active ? 'text-white' : 'text-pine'
                            }`}
                        >
                          {r}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Text className="mb-1.5 text-xs font-bold text-[#3B4F46]">
                    {t(USERS_CONSTANTS.LOCALE_LABEL)}
                  </Text>
                  <View className="flex-row gap-1.5">
                    {LOCALE_OPTIONS.map((loc) => {
                      const active = locale === loc;
                      return (
                        <Pressable
                          key={loc}
                          onPress={() => setLocale(loc)}
                          className={`flex-1 items-center rounded-xl py-2 border ${active ? 'bg-pine border-pine' : 'bg-white border-[#DCECE3]'
                            }`}
                        >
                          <Text
                            className={`text-xs font-bold uppercase ${active ? 'text-white' : 'text-pine'
                              }`}
                          >
                            {loc}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>

              <View>
                <Text className="mb-1.5 text-xs font-bold text-[#3B4F46]">
                  {t(USERS_CONSTANTS.TIMEZONE_LABEL)}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View className="flex-row gap-1.5">
                    {TIMEZONE_OPTIONS.map((tz) => {
                      const active = timezone === tz;
                      return (
                        <Pressable
                          key={tz}
                          onPress={() => setTimezone(tz)}
                          className={`rounded-xl px-3 py-2 border ${active ? 'bg-pine border-pine' : 'bg-white border-[#DCECE3]'
                            }`}
                        >
                          <Text
                            className={`text-xs font-bold ${active ? 'text-white' : 'text-pine'
                              }`}
                          >
                            {tz}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>

              {userFormError ? (
                <View className="rounded-2xl bg-red-50 p-3 border border-red-200">
                  <Text className="text-xs font-bold text-red-700">{userFormError}</Text>
                </View>
              ) : null}

              <Pressable
                onPress={() => void handleSaveUser()}
                disabled={savingUser}
                className="mt-2 flex-row items-center justify-center rounded-2xl bg-pine py-4 shadow-md active:opacity-90 disabled:opacity-50"
              >
                {savingUser ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
                    <Text className="ml-2 text-sm font-extrabold text-white">
                      {editingUser
                        ? t(COMMON_CONSTANTS.SAVE_CHANGES)
                        : t(USERS_CONSTANTS.CREATE_USER_BTN)}
                    </Text>
                  </>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Confirm Logical Delete User Modal */}
      <Modal
        visible={Boolean(userToDelete)}
        animationType="fade"
        transparent
        onRequestClose={() => setUserToDelete(null)}
      >
        <View className="flex-1 items-center justify-center bg-black/40 px-5">
          <View className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-[#FFF5F5] self-center">
              <Feather name="trash-2" size={22} color="#C53030" />
            </View>
            <Text className="mt-3 text-center text-lg font-extrabold text-[#12211B]">
              {t(USERS_CONSTANTS.DELETE_USER_TITLE)}
            </Text>
            <Text className="mt-1.5 text-center text-[13px] text-[#5A6D64]">
              <Text className="font-bold text-[#12211B]">{userToDelete?.full_name}</Text> —{' '}
              {t(COMMON_CONSTANTS.LOGICAL_DELETE_DESC)}
            </Text>

            {deleteUserError ? (
              <View className="mt-3 rounded-xl bg-red-50 p-3">
                <Text className="text-xs font-bold text-red-700">{deleteUserError}</Text>
              </View>
            ) : null}

            <View className="mt-5 flex-row gap-2.5">
              <Pressable
                onPress={() => setUserToDelete(null)}
                disabled={deletingUser}
                className="flex-1 items-center justify-center rounded-2xl bg-[#E8F4ED] py-3"
              >
                <Text className="text-xs font-extrabold text-pine">
                  {t(COMMON_CONSTANTS.CANCEL)}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => void handleConfirmDeleteUser()}
                disabled={deletingUser}
                className="flex-1 items-center justify-center rounded-2xl bg-[#C53030] py-3"
              >
                {deletingUser ? (
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

