import './src/i18n';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useSession } from './src/hooks/useSession';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import ReportScreen from './src/screens/ReportScreen';
import { getReportTokenFromUrl } from './src/lib/report';

// Public report opened from WhatsApp (/reporte?t=<token>): no login needed.
const reportToken = getReportTokenFromUrl();

export default function App() {
  if (reportToken) {
    return (
      <SafeAreaProvider>
        <ReportScreen token={reportToken} />
        <StatusBar style="dark" />
      </SafeAreaProvider>
    );
  }
  return <MainApp />;
}

function MainApp() {
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
