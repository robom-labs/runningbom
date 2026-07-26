// 러닝봄 vNext의 로컬 코어와 선택적 소셜 기능을 다섯 탭 앱으로 조립합니다.
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppNavigator } from './app/navigation/AppNavigator';
import { palette, spacing, typeScale } from './app/design-system/theme';
import { AppStateProvider, useAppState } from './app/state/AppStateProvider';
import { RaceStateProvider } from './app/state/RaceStateProvider';
import { UpdateBanner } from './services/updates';

function ReadyApp() {
  const { ready } = useAppState();
  if (!ready) {
    return (
      <View accessibilityLiveRegion="polite" style={styles.loading}>
        <ActivityIndicator color={palette.accent} size="large" />
        <Text style={styles.loadingText}>내 기록을 준비하고 있어요</Text>
      </View>
    );
  }
  // Preview 빌드에서 새 APK가 올라오면 앱 최상단에 조용히 안내합니다(정식 빌드에서는 렌더되지 않음).
  return (
    <View style={styles.root}>
      <UpdateBanner />
      <AppNavigator />
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <AppStateProvider>
          <RaceStateProvider>
            <ReadyApp />
          </RaceStateProvider>
        </AppStateProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.canvas },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: palette.canvas,
  },
  loadingText: { color: palette.inkSoft, fontSize: typeScale.body, fontWeight: '700' },
});
