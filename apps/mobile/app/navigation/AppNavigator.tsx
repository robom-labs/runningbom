// 하단 탭 대신 좌상단 드로어로 화면을 전환하는 러닝봄의 단일 셸입니다.
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CalendarScreen } from '../screens/calendar/CalendarScreen';
import { CommunityScreen } from '../screens/community/CommunityScreen';
import { HelpScreen } from '../screens/help/HelpScreen';
import { HomeScreen } from '../screens/home/HomeScreen';
import { MyScreen } from '../screens/my/MyScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { RacesScreen } from '../screens/explore/RacesScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { ShoesScreen } from '../screens/explore/ShoesScreen';
import { OnboardingScreen } from '../screens/onboarding';
import { StartScreen } from '../screens/start/StartScreen';
import { palette } from '../design-system/theme';
import { useAppState } from '../state/AppStateProvider';
import { currentWeekStart, formatDistance, totalsForWeek } from '../../domains/activities/summary';
import { raceIdFromDeepLink } from '../../src/races';
import { AppHeader } from './AppHeader';
import { DrawerMenu } from './DrawerMenu';
import { routeFromStoredValue, routeTitles } from './routes';
import { isStatsFocus, type RouteKey, type StatsFocus } from './types';

export function AppNavigator() {
  const { preferences, updatePreferences, activities, streak, ready, onboardingRequired } =
    useAppState();
  const [route, setRoute] = useState<RouteKey>(() => routeFromStoredValue(preferences.lastTab));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [focusedRaceId, setFocusedRaceId] = useState<string>();
  const [focusedShoeId, setFocusedShoeId] = useState<string>();
  // 드로어 하위 메뉴에서 고른 기록·통계 구획입니다. 같은 항목을 다시 골라도 반응하도록 nonce를 둡니다.
  const [statsFocus, setStatsFocus] = useState<{ section: StatsFocus; nonce: number }>();
  const restoredRef = useRef(false);

  // 첫 로딩이 끝나면 마지막으로 보던 화면을 복원합니다.
  useEffect(() => {
    if (!ready || restoredRef.current) return;
    restoredRef.current = true;
    setRoute(routeFromStoredValue(preferences.lastTab));
  }, [preferences.lastTab, ready]);

  const navigate = useCallback(
    (next: RouteKey, focus?: string) => {
      setRoute(next);
      setDrawerOpen(false);
      restoredRef.current = true;
      // 화면이 실제로 받을 수 있는 focus만 전달합니다. 나머지 하위 항목은 이동만 합니다.
      if (next === 'stats' && isStatsFocus(focus)) {
        setStatsFocus((current) => ({ section: focus, nonce: (current?.nonce ?? 0) + 1 }));
      }
      void updatePreferences({ lastTab: next });
    },
    [updatePreferences],
  );

  const openRace = useCallback(
    (raceId?: string) => {
      setFocusedRaceId(raceId);
      navigate('races');
    },
    [navigate],
  );

  const openShoe = useCallback(
    (shoeId?: string) => {
      setFocusedShoeId(shoeId);
      navigate('shoes');
    },
    [navigate],
  );

  const initialUrl = Linking.useLinkingURL();
  useEffect(() => {
    if (!initialUrl) return;
    const raceId = raceIdFromDeepLink(initialUrl);
    if (raceId) openRace(raceId);
  }, [initialUrl, openRace]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const raceId = response.notification.request.content.data?.raceId;
      if (typeof raceId === 'string') openRace(raceId);
    });
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      const raceId = response?.notification.request.content.data?.raceId;
      if (typeof raceId === 'string') openRace(raceId);
    });
    return () => subscription.remove();
  }, [openRace]);

  // 안드로이드 백버튼: 드로어가 열려 있으면 닫고, 홈이 아니면 홈으로 돌아갑니다.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (drawerOpen) {
        setDrawerOpen(false);
        return true;
      }
      if (route !== 'home') {
        navigate('home');
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [drawerOpen, navigate, route]);

  const weekSummary = useMemo(() => {
    const totals = totalsForWeek(activities, currentWeekStart());
    if (totals.sessions === 0) return '이번 주 기록이 아직 없어요';
    const distance = totals.distanceKm > 0 ? ` · ${formatDistance(totals.distanceKm)}` : '';
    return `이번 주 ${totals.sessions}회 · ${totals.minutes}분${distance}`;
  }, [activities]);

  const screen = useMemo(() => {
    switch (route) {
      case 'start':
        return <StartScreen />;
      case 'calendar':
        return <CalendarScreen />;
      case 'races':
        return <RacesScreen focusedRaceId={focusedRaceId} />;
      case 'shoes':
        return <ShoesScreen focusedShoeId={focusedShoeId} />;
      case 'community':
        // Q&A 카드의 "관련 기능으로 이동"이 실제 화면 이동으로 동작하게 연결합니다.
        return <CommunityScreen onNavigate={navigate} />;
      case 'stats':
        return <MyScreen focus={statsFocus} onOpenCalendar={() => navigate('calendar')} />;
      case 'profile':
        return <ProfileScreen onOpenSettings={() => navigate('settings')} />;
      case 'settings':
        return <SettingsScreen onOpenProfile={() => navigate('profile')} />;
      case 'help':
        return <HelpScreen />;
      default:
        return (
          <HomeScreen
            onNavigate={navigate}
            onOpenRace={(raceId) => openRace(raceId)}
            onOpenShoe={(shoeId) => openShoe(shoeId)}
          />
        );
    }
  }, [focusedRaceId, focusedShoeId, navigate, openRace, openShoe, route, statsFocus]);

  // 앱을 처음 연 사람은 드로어 셸 대신 온보딩 3화면을 먼저 봅니다.
  if (onboardingRequired) return <OnboardingScreen />;

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <AppHeader onMenu={() => setDrawerOpen(true)} title={routeTitles[route]} />
      <View style={styles.body}>{screen}</View>
      <DrawerMenu
        activeRoute={route}
        nickname={preferences.nickname}
        onClose={() => setDrawerOpen(false)}
        onSelect={navigate}
        summary={weekSummary}
        tier={streak.tier}
        visible={drawerOpen}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.canvas },
  body: { flex: 1 },
});
