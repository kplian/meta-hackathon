import { ActivityIndicator, Pressable, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { HouseholdRow } from '../../lib/budget-schema';
import { COMMON_CONSTANTS } from '../../i18n';
import OnboardingScreen from './OnboardingScreen';

interface Props {
  household: HouseholdRow | null;
  userId: string;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export default function OnboardingGate({ household, userId, loading, error, onRefresh }: Props) {
  const { t } = useTranslation();
  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-mint">
        <ActivityIndicator size="large" color="#0B3D2E" />
      </SafeAreaView>
    );
  }
  if (error) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-mint px-6">
        <Text className="text-center text-pine">{t(COMMON_CONSTANTS.QUERY_ERROR)}</Text>
        <Pressable onPress={onRefresh} className="mt-4 p-3">
          <Text className="text-pine">{t(COMMON_CONSTANTS.REFRESH)}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }
  return (
    <OnboardingScreen key={household?.id ?? 'new-household'} household={household}
      userId={userId} onComplete={onRefresh} />
  );
}
