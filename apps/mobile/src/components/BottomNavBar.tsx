import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { BOTTOM_TABS, type BottomTabId, type ViewId } from '../navigation/menuConfig';

interface BottomNavBarProps {
  activeView: ViewId;
  onSelectTab: (tab: BottomTabId) => void;
}

export default function BottomNavBar({ activeView, onSelectTab }: BottomNavBarProps) {
  const { t } = useTranslation();

  return (
    <View className="flex-row items-center justify-around border-t border-slate-200/80 bg-white px-2 py-2.5 shadow-sm">
      {BOTTOM_TABS.map((tab) => {
        const isActive = activeView === tab.id;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onSelectTab(tab.id)}
            className="flex-1 items-center justify-center py-1"
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
          >
            <Ionicons
              name={(isActive ? tab.activeIconName : tab.iconName) as never}
              size={22}
              color={isActive ? '#0B3D2E' : '#4E5D55'}
            />
            <Text
              className={`mt-1 text-[11px] ${
                isActive ? 'font-extrabold text-pine' : 'font-medium text-[#4E5D55]'
              }`}
            >
              {t(tab.labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

