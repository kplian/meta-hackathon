import './src/i18n';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useSession } from './src/hooks/useSession';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';

export default function App() {
  const { session, loading } = useSession();

  return (
    <SafeAreaProvider>
      {loading ? (
        <View className="flex-1 items-center justify-center bg-mint">
          <ActivityIndicator size="large" color="#0B3D2E" />
        </View>
      ) : session ? (
        <HomeScreen session={session} />
      ) : (
        <LoginScreen />
      )}
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
