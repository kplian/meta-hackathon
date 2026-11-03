import './src/i18n';
import { useEffect, useState } from 'react';
import ResetPasswordScreen from './src/features/auth-session/ResetPasswordScreen';
import InvitationGate from './src/features/household-access/InvitationGate';
import { captureInvitation, saveInvitationUrl } from './src/features/household-access/storage';
import { ActivityIndicator, Linking, View } from 'react-native';
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
  const { session, loading, authError, clearAuthError, recovery, finishRecovery } = useSession();
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteReady, setInviteReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    captureInvitation().then(token => { if (!cancelled) setInviteToken(token); }).catch(() => {}).finally(() => { if (!cancelled) setInviteReady(true); });
    const listener = Linking.addEventListener('url', ({ url }) => { void saveInvitationUrl(url).then(token => { if (!cancelled && token) setInviteToken(token); }); });
    return () => { cancelled = true; listener.remove(); };
  }, []);

  return (
    <SafeAreaProvider>
      {loading || !inviteReady ? (
        <View className="flex-1 items-center justify-center bg-mint">
          <ActivityIndicator size="large" color="#0B3D2E" />
        </View>
      ) : session && recovery ? (
        <ResetPasswordScreen onDone={finishRecovery} />
      ) : session ? (
        <InvitationGate key={session.user.id} session={session} token={inviteToken}>{householdId => <HomeScreen session={session} preferredHouseholdId={householdId} />}</InvitationGate>
      ) : (
        <LoginScreen invited={!!inviteToken} callbackError={authError} onClearError={clearAuthError} />
      )}
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
