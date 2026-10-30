import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { signOut } from '../lib/auth';
import type { HouseholdRow } from '../lib/budget-schema';
import {
  DRAWER_SECTIONS,
  VIEW_META,
  type BottomTabId,
  type ViewId,
} from '../navigation/menuConfig';
import {
  COMMON_CONSTANTS,
  DASHBOARD_CONSTANTS,
  NAV_CONSTANTS,
  PROFILE_CONSTANTS,
  SUPPORTED_LANGUAGES,
  changeAppLanguage,
  type SupportedLanguage,
} from '../i18n';
import SidebarDrawer from '../components/SidebarDrawer';
import BottomNavBar from '../components/BottomNavBar';
import JournalView from '../components/JournalView';
import UsersView from '../components/UsersView';
import AccountTypesView from '../components/AccountTypesView';
import AuxiliarTypesView from '../components/AuxiliarTypesView';
import BusinessTypesView from '../components/BusinessTypesView';
import AccountsView from '../components/AccountsView';
import BudgetTypesView from '../components/BudgetTypesView';
import FinancialPyramidsView from '../components/FinancialPyramidsView';
import TemplateTransactionsView from '../components/TemplateTransactionsView';
import HouseholdsView from '../components/HouseholdsView';
import BudgetsView from '../components/BudgetsView';
import AuxiliarsView from '../components/AuxiliarsView';

type GenericRow = Record<string, unknown>;

export default function HomeScreen({ session }: { session: Session }) {
  const { t, i18n } = useTranslation();
  const { width } = useWindowDimensions();
  const isPermanentDesktop = width >= 960;
  const currentLang = (i18n.language?.slice(0, 2) || 'es') as SupportedLanguage;

  const formatFieldValue = (value: unknown): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? t(COMMON_CONSTANTS.YES) : t(COMMON_CONSTANTS.NO);
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  // Open the left menu initially so the user immediately sees the navigation drawer from the design
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeView, setActiveView] = useState<ViewId>('dashboard');

  const [households, setHouseholds] = useState<HouseholdRow[]>([]);
  const [activeHouseholdIndex, setActiveHouseholdIndex] = useState(0);
  const [usersCount, setUsersCount] = useState<number | undefined>(undefined);

  // Active view table records
  const [rows, setRows] = useState<GenericRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const email = session.user.email ?? 'admin@nido.app';
  const fullName =
    (session.user.user_metadata?.full_name as string | undefined) ||
    (session.user.user_metadata?.name as string | undefined) ||
    'Familia Morales';

  const activeHousehold = households[activeHouseholdIndex] ?? null;

  // Load initial summary counts & households joined with budget.thousehold_member filtered by user_id
  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      const [hhMemberRes, usersRes] = await Promise.all([
        supabase
          .schema('budget')
          .from('thousehold_member')
          .select('id, role, member_type, user_id, thousehold(*)')
          .eq('user_id', session.user.id)
          .eq('status', 'active'),
        supabase
          .schema('budget')
          .from('tuser')
          .select('id', { count: 'exact', head: true })
          .is('deleted_at', null),
      ]);

      if (cancelled) return;
      if (hhMemberRes.data) {
        const joinedHouseholds = hhMemberRes.data
          .map((row) => row.thousehold as unknown as HouseholdRow | null)
          .filter((h): h is HouseholdRow => Boolean(h));
        setHouseholds(joinedHouseholds);
      }
      if (usersRes.count !== null && usersRes.count !== undefined) {
        setUsersCount(usersRes.count);
      }
    }

    void loadInitialData();
    return () => {
      cancelled = true;
    };
  }, [refreshTick, session.user.id]);

  // Load records whenever activeView changes to a table-backed screen
  useEffect(() => {
    let cancelled = false;
    const meta = VIEW_META[activeView];

    async function loadTableRows() {
      if (!meta.table) {
        setRows([]);
        setQueryError(null);
        return;
      }

      setLoadingRows(true);
      setQueryError(null);
      try {
        const { data, error } = await supabase
          .schema('budget')
          .from(meta.table)
          .select('*')
          .limit(25);
        if (cancelled) return;
        if (error) {
          setQueryError(error.message);
          setRows([]);
        } else {
          setRows((data as GenericRow[]) ?? []);
        }
      } finally {
        if (!cancelled) setLoadingRows(false);
      }
    }

    void loadTableRows();
    return () => {
      cancelled = true;
    };
  }, [activeView, refreshTick]);

  const handleSelectView = (view: ViewId) => {
    setActiveView(view);
    if (!isPermanentDesktop) {
      setIsDrawerOpen(false);
    }
  };

  const handleSelectBottomTab = (tab: BottomTabId) => {
    setActiveView(tab);
    if (!isPermanentDesktop) {
      setIsDrawerOpen(false);
    }
  };

  const handleToggleMenuButton = () => {
    if (isPermanentDesktop) {
      setIsCollapsed((prev) => !prev);
    } else {
      setIsDrawerOpen((prev) => !prev);
    }
  };

  const handleSwitchHousehold = () => {
    if (households.length > 1) {
      setActiveHouseholdIndex((prev) => (prev + 1) % households.length);
    } else {
      handleSelectView('household');
    }
  };

  const currentMeta = VIEW_META[activeView];

  return (
    <SafeAreaView className="flex-1 bg-[#E9F5EE]">
      {/* Top Navbar (Matches design: Hamburger | ● Budget | Active View Label | Profile Icon) */}
      <View className="flex-row items-center justify-between bg-[#E9F5EE] px-4 py-3">
        <View className="flex-row items-center">
          <Pressable
            onPress={handleToggleMenuButton}
            className="h-10 w-10 items-center justify-center rounded-xl active:bg-[#D5E8DC]"
            accessibilityLabel="Abrir o colapsar menú lateral"
          >
            <Ionicons name="menu" size={24} color="#0B3D2E" />
          </Pressable>

          <Pressable
            onPress={() => handleSelectView('dashboard')}
            className="ml-2 flex-row items-center"
          >
            <View className="h-3 w-3 rounded-full bg-[#FF6B00]" />
            <Text className="ml-1.5 text-[20px] font-extrabold tracking-tight text-pine">
              Budget
            </Text>
          </Pressable>
        </View>

        <View className="flex-row items-center">
          {/* Quick Language Switcher Pill in Header */}
          <View className="mr-2.5 flex-row rounded-full bg-[#DCECE3] p-0.5 border border-[#C6DFD1]">
            {SUPPORTED_LANGUAGES.map((lang) => {
              const active = currentLang === lang.code;
              return (
                <Pressable
                  key={lang.code}
                  onPress={() => void changeAppLanguage(lang.code)}
                  className={`rounded-full px-2 py-0.5 ${active ? 'bg-pine' : ''}`}
                >
                  <Text
                    className={`text-[10px] font-extrabold ${
                      active ? 'text-white' : 'text-pine'
                    }`}
                  >
                    {lang.shortLabel}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text className="mr-3 text-[14px] font-semibold text-[#263C33]">
            {t(currentMeta.titleKey)}
          </Text>
          <Pressable
            onPress={() => handleSelectView('profile')}
            className="h-9 w-9 items-center justify-center rounded-full bg-pine active:opacity-85"
            accessibilityLabel={t(NAV_CONSTANTS.PROFILE_LABEL)}
          >
            <Ionicons name="person-outline" size={18} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      {/* Main Body Area (Collapsible Left Drawer + Active Screen Content) */}
      <View className="relative flex-1 flex-row overflow-hidden">
        <SidebarDrawer
          isOpen={isDrawerOpen}
          isCollapsed={isCollapsed}
          isPermanentDesktop={isPermanentDesktop}
          activeView={activeView}
          activeHousehold={activeHousehold}
          userEmail={email}
          userName={fullName}
          usersCount={usersCount}
          onSelectView={handleSelectView}
          onCloseMobile={() => setIsDrawerOpen(false)}
          onToggleCollapse={() => setIsCollapsed((prev) => !prev)}
          onSwitchHousehold={handleSwitchHousehold}
          onSignOut={() => void signOut()}
        />

        {/* Active Interface Content */}
        {activeView === 'journal' ? (
          <JournalView
            userId={session.user.id}
            activeHousehold={activeHousehold}
            households={households}
            userEmail={email}
            onSelectHousehold={(hh) => {
              const idx = households.findIndex((item) => item.id === hh.id);
              if (idx >= 0) setActiveHouseholdIndex(idx);
            }}
            onSwitchHousehold={handleSwitchHousehold}
          />
        ) : activeView === 'users' ? (
          <UsersView
            currentUserId={session.user.id}
            onUsersChanged={(count) => setUsersCount(count)}
          />
        ) : activeView === 'account_type' ? (
          <AccountTypesView currentUserId={session.user.id} />
        ) : activeView === 'auxiliar_type' ? (
          <AuxiliarTypesView currentUserId={session.user.id} />
        ) : activeView === 'business_type' ? (
          <BusinessTypesView currentUserId={session.user.id} />
        ) : activeView === 'account' ? (
          <AccountsView currentUserId={session.user.id} />
        ) : activeView === 'budget_type' ? (
          <BudgetTypesView currentUserId={session.user.id} />
        ) : activeView === 'financial_pyramid' ? (
          <FinancialPyramidsView currentUserId={session.user.id} />
        ) : activeView === 'template_transaction' ? (
          <TemplateTransactionsView currentUserId={session.user.id} />
        ) : activeView === 'household' ? (
          <HouseholdsView
            currentUserId={session.user.id}
            onHouseholdsChanged={() => setRefreshTick((t) => t + 1)}
          />
        ) : activeView === 'budget' ? (
          <BudgetsView
            currentUserId={session.user.id}
            activeHousehold={activeHousehold}
          />
        ) : activeView === 'auxiliar' ? (
          <AuxiliarsView
            currentUserId={session.user.id}
            activeHousehold={activeHousehold}
          />
        ) : (
        <ScrollView
          className="flex-1 bg-[#F4FAF6] rounded-t-3xl"
          contentContainerClassName="p-5 pb-10"
        >
          {/* Breadcrumb & Header Card */}
          <View className="rounded-3xl bg-white p-5 shadow-sm border border-[#E2EFE8]">
            <View className="flex-row items-center justify-between">
              <View className="flex-1 mr-3">
                <View className="flex-row items-center">
                  <View className="rounded-full bg-[#E6F4EC] px-2.5 py-0.5">
                    <Text className="text-[10px] font-extrabold tracking-wider text-pine">
                      {currentMeta.category}
                    </Text>
                  </View>
                  {currentMeta.table ? (
                    <View className="ml-2 rounded-full bg-[#F1F5F3] px-2.5 py-0.5">
                      <Text className="text-[10px] font-semibold text-sage">
                        budget.{currentMeta.table}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <Text className="mt-2 text-2xl font-extrabold text-pine">
                  {t(currentMeta.titleKey)}
                </Text>
                <Text className="mt-1 text-[13px] leading-5 text-sage">
                  {t(currentMeta.subtitleKey)}
                </Text>
              </View>

              <Pressable
                onPress={() => setRefreshTick((t) => t + 1)}
                className="h-10 w-10 items-center justify-center rounded-full bg-[#E8F4ED] active:bg-[#D5E8DC]"
                accessibilityLabel={t(COMMON_CONSTANTS.REFRESH)}
              >
                <Ionicons name="refresh" size={18} color="#0B3D2E" />
              </Pressable>
            </View>
          </View>

          {/* View-Specific Content */}
          {activeView === 'dashboard' ? (
            <View className="mt-5 gap-4">
              {/* Summary KPI cards */}
              <View className="flex-row flex-wrap gap-3">
                <View className="min-w-[150px] flex-1 rounded-3xl bg-pine p-4">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs font-bold uppercase tracking-wider text-[#A9D6C2]">
                      {t(DASHBOARD_CONSTANTS.ACTIVE_HOUSEHOLD)}
                    </Text>
                    <MaterialCommunityIcons name="home-heart" size={20} color="#BCEAD5" />
                  </View>
                  <Text className="mt-2 text-lg font-extrabold text-white" numberOfLines={1}>
                    {activeHousehold?.name ?? t(NAV_CONSTANTS.NO_HOUSEHOLD_ASSIGNED)}
                  </Text>
                  <Text className="mt-0.5 text-xs text-[#BCEAD5]">
                    {t(DASHBOARD_CONSTANTS.CURRENCY_LABEL)}: {activeHousehold?.currency ?? 'BOB'}
                  </Text>
                </View>

                <View className="min-w-[150px] flex-1 rounded-3xl bg-white p-4 border border-[#E2EFE8]">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs font-bold uppercase tracking-wider text-sage">
                      {t(DASHBOARD_CONSTANTS.HOUSEHOLDS_CARD)}
                    </Text>
                    <Ionicons name="home-outline" size={18} color="#0B3D2E" />
                  </View>
                  <Text className="mt-2 text-2xl font-extrabold text-pine">
                    {households.length}
                  </Text>
                  <Text className="mt-0.5 text-xs text-sage">
                    {t(DASHBOARD_CONSTANTS.REGISTERED_IN_SUPABASE)}
                  </Text>
                </View>
              </View>

              {/* Quick Navigation Grid for All Drawer Modules */}
              {DRAWER_SECTIONS.map((section) => (
                <View
                  key={section.title}
                  className="rounded-3xl bg-white p-5 border border-[#E2EFE8]"
                >
                  <View className="mb-3 flex-row items-center justify-between">
                    <Text className="text-xs font-extrabold tracking-wider text-sage">
                      {t(section.titleKey)}
                    </Text>
                    <Text className="text-xs font-bold text-[#9BA8A2]">
                      {section.count} {t(NAV_CONSTANTS.MODULES_COUNT)}
                    </Text>
                  </View>

                  <View className="gap-2">
                    {section.items.map((item) => (
                      <Pressable
                        key={item.id}
                        onPress={() => handleSelectView(item.id)}
                        className="flex-row items-center justify-between rounded-2xl bg-[#F4FAF6] px-3.5 py-3 active:bg-[#E4F4EC]"
                      >
                        <View className="flex-row items-center">
                          <View className="h-9 w-9 items-center justify-center rounded-xl bg-[#E2EFE8]">
                            <Ionicons name="folder-open-outline" size={17} color="#0B3D2E" />
                          </View>
                          <View className="ml-3">
                            <Text className="text-[14px] font-bold text-pine">
                              {t(item.labelKey)}
                            </Text>
                            <Text className="text-[11px] text-sage" numberOfLines={1}>
                              {t(VIEW_META[item.id].subtitleKey)}
                            </Text>
                          </View>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#0B3D2E" />
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          ) : activeView === 'profile' ? (
            <View className="mt-5 rounded-3xl bg-white p-6 border border-[#E2EFE8] gap-4">
              <View className="flex-row items-center">
                <View className="h-14 w-14 items-center justify-center rounded-full bg-pine">
                  <Text className="text-lg font-extrabold text-white">
                    {fullName.slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View className="ml-4 flex-1">
                  <Text className="text-lg font-extrabold text-pine">{fullName}</Text>
                  <Text className="text-sm text-sage">{email}</Text>
                </View>
              </View>

              {/* Language Preference Card */}
              <View className="rounded-2xl bg-[#F4FAF6] p-4 gap-2.5">
                <Text className="text-xs font-bold uppercase tracking-wider text-sage">
                  {t(PROFILE_CONSTANTS.LANGUAGE_PREFERENCE)}
                </Text>
                <Text className="text-xs text-[#546A60]">
                  {t(PROFILE_CONSTANTS.LANGUAGE_SUBTITLE)}
                </Text>
                <View className="flex-row gap-2 mt-1">
                  {SUPPORTED_LANGUAGES.map((lang) => {
                    const active = currentLang === lang.code;
                    return (
                      <Pressable
                        key={lang.code}
                        onPress={() => void changeAppLanguage(lang.code)}
                        className={`flex-1 items-center justify-center rounded-xl py-2.5 border ${
                          active
                            ? 'bg-pine border-pine'
                            : 'bg-white border-[#D3E8DC] active:bg-[#E8F6EE]'
                        }`}
                      >
                        <Text
                          className={`text-xs font-extrabold ${
                            active ? 'text-white' : 'text-pine'
                          }`}
                        >
                          {lang.label} ({lang.shortLabel})
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View className="rounded-2xl bg-[#F4FAF6] p-4 gap-2">
                <Text className="text-xs font-bold uppercase tracking-wider text-sage">
                  {t(PROFILE_CONSTANTS.SESSION_DETAILS)}
                </Text>
                <Text className="text-xs text-[#263C33]">
                  {t(PROFILE_CONSTANTS.USER_ID)}: {session.user.id}
                </Text>
                <Text className="text-xs text-[#263C33]">
                  {t(PROFILE_CONSTANTS.PROVIDER)}: {session.user.app_metadata?.provider ?? 'email'}
                </Text>
              </View>

              <Pressable
                onPress={() => void signOut()}
                className="flex-row items-center justify-center rounded-2xl bg-pine py-3.5 active:opacity-85"
              >
                <Ionicons name="log-out-outline" size={18} color="#FFFFFF" />
                <Text className="ml-2 text-sm font-bold text-white">
                  {t(COMMON_CONSTANTS.SIGN_OUT)}
                </Text>
              </Pressable>
            </View>
          ) : (
            /* Table-Backed Module View (Admin / For Business / Budget / Members / Journal) */
            <View className="mt-5 rounded-3xl bg-white p-5 border border-[#E2EFE8]">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-base font-extrabold text-pine">
                  {t(COMMON_CONSTANTS.RECORDS)} ({rows.length})
                </Text>
                <Pressable
                  onPress={() => setIsDrawerOpen(true)}
                  className="rounded-full bg-[#E8F6EE] px-3 py-1.5"
                >
                  <Text className="text-xs font-bold text-pine">
                    {t(COMMON_CONSTANTS.SIDE_MENU)}
                  </Text>
                </Pressable>
              </View>

              {loadingRows ? (
                <View className="py-10 items-center">
                  <ActivityIndicator size="large" color="#0B3D2E" />
                  <Text className="mt-2 text-xs text-sage">
                    {t(COMMON_CONSTANTS.QUERYING)} budget.{currentMeta.table}...
                  </Text>
                </View>
              ) : queryError ? (
                <View className="rounded-2xl bg-red-50 p-4">
                  <Text className="text-xs font-bold text-red-700">
                    {t(COMMON_CONSTANTS.QUERY_ERROR)}
                  </Text>
                  <Text className="mt-1 text-xs text-red-600">{queryError}</Text>
                </View>
              ) : rows.length === 0 ? (
                <View className="items-center py-8 px-4 rounded-2xl bg-[#F4FAF6]">
                  <Ionicons name="layers-outline" size={28} color="#5F7269" />
                  <Text className="mt-2 text-sm font-bold text-pine text-center">
                    {t(COMMON_CONSTANTS.NO_RECORDS_IN)} {t(currentMeta.titleKey)}
                  </Text>
                  <Text className="mt-1 text-xs text-sage text-center leading-4">
                    {t(COMMON_CONSTANTS.TABLE_READY_EMPTY)}
                  </Text>
                </View>
              ) : (
                <View className="gap-3">
                  {rows.map((row, idx) => {
                    const primaryTitle =
                      (row.name as string) ||
                      (row.full_name as string) ||
                      (row.concept as string) ||
                      (row.code as string) ||
                      (row.category_key as string) ||
                      `Registro #${idx + 1}`;

                    const entries = Object.entries(row).filter(
                      ([k]) =>
                        !['created_at', 'updated_at', 'deleted_at', 'created_by', 'updated_by', 'deleted_by'].includes(
                          k,
                        ),
                    );

                    return (
                      <View
                        key={(row.id as string) ?? String(idx)}
                        className="rounded-2xl bg-[#F4FAF6] p-4 border border-[#E2EFE8]"
                      >
                        <Text className="text-sm font-extrabold text-pine">{primaryTitle}</Text>
                        <View className="mt-2 gap-1">
                          {entries.slice(0, 6).map(([key, val]) => (
                            <View key={key} className="flex-row justify-between">
                              <Text className="text-[11px] font-semibold text-sage">{key}:</Text>
                              <Text
                                className="text-[11px] font-bold text-[#1F2D27] ml-2 flex-1 text-right"
                                numberOfLines={1}
                              >
                                {formatFieldValue(val)}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}
        </ScrollView>
        )}
      </View>

      {/* Bottom Navigation Bar (Members | Budget | Journal | Dashboard | Profile) */}
      <BottomNavBar activeView={activeView} onSelectTab={handleSelectBottomTab} />
    </SafeAreaView>
  );
}
