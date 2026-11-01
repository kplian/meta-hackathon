import { Pressable, ScrollView, Text, View } from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  getVisibleDrawerSections,
  type DrawerMenuItem,
  type ViewId,
} from '../navigation/menuConfig';
import type { HouseholdRow } from '../lib/budget-schema';
import { COMMON_CONSTANTS, NAV_CONSTANTS } from '../i18n/constants';

interface SidebarDrawerProps {
  isOpen: boolean;
  isCollapsed: boolean;
  isPermanentDesktop: boolean;
  activeView: ViewId;
  activeHousehold: HouseholdRow | null;
  userEmail: string;
  userName: string;
  userRole?: string;
  usersCount?: number;
  onSelectView: (view: ViewId) => void;
  onCloseMobile: () => void;
  onToggleCollapse: () => void;
  onSwitchHousehold: () => void;
  onSignOut: () => void;
}

function MenuIcon({
  family,
  name,
  size = 19,
  color = '#44564E',
}: {
  family: DrawerMenuItem['iconFamily'];
  name: string;
  size?: number;
  color?: string;
}) {
  if (family === 'mci') {
    return <MaterialCommunityIcons name={name as never} size={size} color={color} />;
  }
  if (family === 'feather') {
    return <Feather name={name as never} size={size} color={color} />;
  }
  return <Ionicons name={name as never} size={size} color={color} />;
}

function getInitials(name: string, email: string): string {
  const source = name.trim() || email.trim();
  const parts = source.split(/[\s._@-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase() || 'FM';
}

export default function SidebarDrawer({
  isOpen,
  isCollapsed,
  isPermanentDesktop,
  activeView,
  activeHousehold,
  userEmail,
  userName,
  userRole = 'member',
  usersCount,
  onSelectView,
  onCloseMobile,
  onToggleCollapse,
  onSwitchHousehold,
  onSignOut,
}: SidebarDrawerProps) {
  const { t } = useTranslation();

  if (!isOpen && !isPermanentDesktop) {
    return null;
  }

  const visibleSections = getVisibleDrawerSections(userRole);
  const householdTitle = activeHousehold?.name ?? t(NAV_CONSTANTS.NO_HOUSEHOLD_ASSIGNED);
  const householdSubtitle = activeHousehold
    ? `${t(NAV_CONSTANTS.HOUSEHOLD_PREFIX)} ${activeHousehold.name.toUpperCase()}`
    : t(NAV_CONSTANTS.NO_HOUSEHOLD_SHORT);
  const initials = getInitials(userName, userEmail);

  // Collapsed mini-rail mode (when user collapses the left menu on desktop/tablet)
  if (isCollapsed && isPermanentDesktop) {
    return (
      <View className="w-20 border-r border-slate-200 bg-white flex-col justify-between py-4 items-center">
        <View className="items-center w-full">
          <Pressable
            onPress={onToggleCollapse}
            className="h-12 w-12 items-center justify-center rounded-2xl bg-pine"
            accessibilityLabel="Expand menu"
          >
            <MaterialCommunityIcons name="home-city-outline" size={22} color="#FFFFFF" />
          </Pressable>

          <Pressable
            onPress={() => onSelectView('dashboard')}
            className={`mt-5 h-11 w-11 items-center justify-center rounded-2xl ${
              activeView === 'dashboard' ? 'bg-[#BCEAD5]' : 'bg-[#E5ECE8]'
            }`}
            accessibilityLabel="Dashboard"
          >
            <Ionicons name="grid" size={20} color="#0B3D2E" />
          </Pressable>

          <ScrollView className="mt-4 w-full" contentContainerClassName="items-center gap-2.5 pb-4">
            {visibleSections.flatMap((section) => section.items).map((item) => {
              const selected = activeView === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => onSelectView(item.id)}
                  className={`relative h-10 w-10 items-center justify-center rounded-xl ${
                    selected ? 'bg-[#BCEAD5]' : 'bg-[#E5ECE8]'
                  }`}
                  accessibilityLabel={item.label}
                >
                  <MenuIcon
                    family={item.iconFamily}
                    name={item.iconName}
                    size={18}
                    color={selected ? '#0B3D2E' : '#44564E'}
                  />
                  {item.hasDot ? (
                    <View className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#FF6B00]" />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View className="items-center gap-2">
          <View className="items-center">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-pine">
              <Text className="text-xs font-extrabold text-white">{initials}</Text>
            </View>
            <View className="mt-1 rounded bg-[#D6EFE0] px-1 py-0.5">
              <Text className="text-[8px] font-extrabold uppercase text-pine">
                {userRole.slice(0, 3)}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={onSignOut}
            className="h-9 w-9 items-center justify-center rounded-full bg-[#DCE9E2]"
            accessibilityLabel="Cerrar sesión"
          >
            <Ionicons name="log-out-outline" size={18} color="#0B3D2E" />
          </Pressable>
        </View>
      </View>
    );
  }

  const drawerContent = (
    <View className="flex-1 bg-white rounded-t-3xl overflow-hidden flex-col justify-between shadow-lg">
      {/* Top & Scrollable Menu */}
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pt-5 pb-6"
        showsVerticalScrollIndicator={false}
      >
        {/* Household Top Header */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-pine">
              <MaterialCommunityIcons name="home-city-outline" size={24} color="#FFFFFF" />
            </View>
            <View className="ml-3">
              <View className="flex-row items-center">
                <Text className="text-[19px] font-extrabold text-pine">
                  {t(NAV_CONSTANTS.HOUSEHOLD_LABEL)}
                </Text>
                <View className="ml-1.5 h-2 w-2 rounded-full bg-[#FF6B00]" />
              </View>
              <Text className="text-[10px] font-bold tracking-wider text-sage">
                {householdSubtitle}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={isPermanentDesktop ? onToggleCollapse : onCloseMobile}
            className="h-10 w-10 items-center justify-center rounded-full bg-[#E8F3EC] active:bg-[#D5E8DC]"
            accessibilityLabel={t(COMMON_CONSTANTS.CLOSE)}
          >
            <Ionicons
              name={isPermanentDesktop ? 'chevron-back' : 'close'}
              size={20}
              color="#0B3D2E"
            />
          </Pressable>
        </View>

        {/* Active Household Switcher Card */}
        <View className="mt-4 flex-row items-center justify-between rounded-2xl bg-[#E8F6EE] px-3.5 py-3">
          <View className="flex-row items-center flex-1 mr-2">
            <View className="h-9 w-9 items-center justify-center rounded-full bg-[#CBEBD9]">
              <MaterialCommunityIcons name="human-male-female-child" size={18} color="#0B3D2E" />
            </View>
            <View className="ml-2.5 flex-1">
              <Text className="text-[13px] font-extrabold text-pine" numberOfLines={1}>
                {householdTitle}
              </Text>
              <Text className="text-[11px] text-sage" numberOfLines={1}>
                {t(NAV_CONSTANTS.SHARED_EXPENSE_SPACE)}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={onSwitchHousehold}
            className="rounded-full bg-[#D3EBDD] px-3 py-1.5 active:bg-[#BFE0CD]"
          >
            <Text className="text-[11px] font-bold text-pine">{t(COMMON_CONSTANTS.CHANGE)}</Text>
          </Pressable>
        </View>

        {/* Featured Dashboard CTA Pill */}
        <Pressable
          onPress={() => onSelectView('dashboard')}
          className={`mt-3.5 flex-row items-center justify-between rounded-2xl px-3.5 py-3 ${
            activeView === 'dashboard' ? 'bg-[#BCEAD5]' : 'bg-[#D6F2E4]'
          }`}
        >
          <View className="flex-row items-center">
            <View className="h-9 w-9 items-center justify-center rounded-xl bg-[#E9F9F0]">
              <Ionicons name="grid" size={18} color="#0B3D2E" />
            </View>
            <Text className="ml-3 text-[15px] font-bold text-pine">
              {t(NAV_CONSTANTS.DASHBOARD_LABEL)}
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color="#0B3D2E" />
        </Pressable>

        {/* Menu Sections: ADMIN, FOR BUSINESS, BUDGET filtered by role */}
        {visibleSections.map((section) => (
          <View key={section.title} className="mt-5">
            <View className="mb-2 flex-row items-center justify-between px-1">
              <Text className="text-[11px] font-bold tracking-wider text-[#6E7F77]">
                {t(section.titleKey)}
              </Text>
              <Text className="text-[11px] font-semibold text-[#9BA8A2]">{section.count}</Text>
            </View>

            <View className="gap-1.5">
              {section.items.map((item) => {
                const isSelected = activeView === item.id;
                const badgeValue =
                  item.id === 'users' && usersCount !== undefined ? usersCount : item.badgeCount;

                return (
                  <Pressable
                    key={item.id}
                    onPress={() => onSelectView(item.id)}
                    className={`flex-row items-center justify-between rounded-2xl px-2.5 py-2 ${
                      isSelected ? 'bg-[#E4F4EC]' : 'active:bg-slate-50'
                    }`}
                  >
                    <View className="flex-row items-center flex-1">
                      <View
                        className={`h-9 w-9 items-center justify-center rounded-xl ${
                          isSelected ? 'bg-[#BCEAD5]' : 'bg-[#E4ECE8]'
                        }`}
                      >
                        <MenuIcon
                          family={item.iconFamily}
                          name={item.iconName}
                          size={18}
                          color={isSelected ? '#0B3D2E' : '#44564E'}
                        />
                      </View>
                      <Text
                        className={`ml-3 text-[14px] ${
                          isSelected ? 'font-bold text-pine' : 'font-medium text-[#1F2D27]'
                        }`}
                      >
                        {t(item.labelKey)}
                      </Text>
                    </View>

                    {badgeValue !== undefined ? (
                      <View className="rounded-full bg-[#DCE9E2] px-2.5 py-0.5">
                        <Text className="text-[11px] font-bold text-pine">{badgeValue}</Text>
                      </View>
                    ) : item.hasDot ? (
                      <View className="mr-1 h-2.5 w-2.5 rounded-full bg-[#FF6B00]" />
                    ) : (
                      <Ionicons name="chevron-forward" size={15} color="#B0BMB6" />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Footer Profile & Sync Banner */}
      <View className="bg-[#E6F4EC] px-4 py-3.5 border-t border-[#D5E8DC]">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1 mr-2">
            <View className="h-11 w-11 items-center justify-center rounded-full bg-pine">
              <Text className="text-sm font-extrabold text-white">{initials}</Text>
            </View>
            <View className="ml-3 flex-1">
              <View className="flex-row items-center gap-1.5">
                <Text className="text-[13px] font-extrabold text-pine flex-1" numberOfLines={1}>
                  {userName || householdTitle}
                </Text>
                <View className="rounded-md bg-[#D6EFE0] px-1.5 py-0.5">
                  <Text className="text-[9px] font-extrabold uppercase text-pine">
                    {userRole}
                  </Text>
                </View>
              </View>
              <Text className="text-[11px] text-sage" numberOfLines={1}>
                {userEmail}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={onSignOut}
            className="h-9 w-9 items-center justify-center rounded-full bg-[#D5E6DC] active:bg-[#C1D9CC]"
            accessibilityLabel="Cerrar sesión"
          >
            <Ionicons name="log-out-outline" size={18} color="#0B3D2E" />
          </Pressable>
        </View>
      </View>
    </View>
  );

  // Desktop permanent collapsible panel
  if (isPermanentDesktop) {
    return (
      <View className="w-80 border-r border-slate-200 bg-[#E9F5EE] pt-2">{drawerContent}</View>
    );
  }

  // Mobile / Overlay collapsible drawer
  return (
    <View className="absolute inset-0 z-30 flex-row">
      {/* Backdrop */}
      <Pressable
        onPress={onCloseMobile}
        className="absolute inset-0 bg-black/25"
        accessibilityLabel="Cerrar menú"
      />
      {/* Drawer Sheet */}
      <View className="w-[88%] max-w-[360px] flex-1 bg-[#E9F5EE] pt-2 z-40">
        {drawerContent}
      </View>
    </View>
  );
}

