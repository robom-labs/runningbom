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
import { AuthScreen } from '../screens/auth';
import { BadgesScreen } from '../screens/badges';
import { CadenceScreen } from '../screens/cadence';
import { ChallengesScreen } from '../screens/challenges';
import { GuideScreen } from '../screens/guide';
import { OnboardingScreen } from '../screens/onboarding';
import { ProgramsScreen } from '../screens/programs';
import { VoicePickerScreen } from '../screens/voice';
import { StartScreen } from '../screens/start/StartScreen';
import { palette } from '../design-system/theme';
import { useAppState } from '../state/AppStateProvider';
import { currentWeekStart, formatDistance, totalsForWeek } from '../../domains/activities/summary';
import { raceIdFromDeepLink } from '../../src/races';
import {
  destinationForRoute,
  isTopLevelRoute,
  tabBarVisible,
} from '../../domains/navigation/destinations';
import { PrimaryTabBar } from './PrimaryTabBar';
import { TopBar } from './TopBar';
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
  // 홈의 오늘 카드에서 "바로 시작"을 눌렀을 때 훈련 화면에 넘길 요청입니다.
  const [startRequest, setStartRequest] = useState<{
    kind: 'plan' | 'workout';
    workoutId?: string;
    nonce: number;
  }>();
  // 뒤로가기가 무조건 홈으로 튀지 않도록, 지나온 화면을 쌓아 둡니다.
  const historyRef = useRef<RouteKey[]>([]);
  const restoredRef = useRef(false);

  // 첫 로딩이 끝나면 마지막으로 보던 화면을 복원합니다.
  useEffect(() => {
    if (!ready || restoredRef.current) return;
    restoredRef.current = true;
    setRoute(routeFromStoredValue(preferences.lastTab));
  }, [preferences.lastTab, ready]);

  const navigate = useCallback(
    (next: RouteKey, focus?: string) => {
      setRoute((current) => {
        if (current !== next) {
          // 같은 화면을 다시 눌렀을 때는 쌓지 않고, 되돌이 경로가 길어지지 않게 20개로 제한합니다.
          historyRef.current = [...historyRef.current, current].slice(-20);
        }
        return next;
      });
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

  /**
   * 안드로이드 백버튼 규칙입니다.
   * 1. 드로어가 열려 있으면 드로어만 닫습니다.
   * 2. 지나온 화면이 있으면 바로 직전 화면으로 돌아갑니다(홈으로 튀지 않습니다).
   * 3. 지나온 화면이 없는데 홈이 아니면 홈으로 갑니다.
   * 4. 홈에서 누르면 앱을 닫습니다.
   */
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (drawerOpen) {
        setDrawerOpen(false);
        return true;
      }
      const previous = historyRef.current.pop();
      if (previous) {
        setRoute(previous);
        void updatePreferences({ lastTab: previous });
        return true;
      }
      if (route !== 'home') {
        setRoute('home');
        void updatePreferences({ lastTab: 'home' });
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [drawerOpen, route, updatePreferences]);

  /** 화면 안의 "돌아가기" 버튼도 백버튼과 같은 규칙을 씁니다. */
  const goBack = useCallback(
    (fallback: RouteKey = 'home') => {
      const previous = historyRef.current.pop();
      const target = previous ?? fallback;
      setRoute(target);
      void updatePreferences({ lastTab: target });
    },
    [updatePreferences],
  );

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
      case 'programs':
        return (
          <ProgramsScreen
            onBack={() => goBack()}
            onOpenRaces={() => navigate('races')}
            {...(startRequest ? { startRequest } : {})}
          />
        );
      case 'calendar':
        return <CalendarScreen />;
      case 'races':
        return <RacesScreen focusedRaceId={focusedRaceId} />;
      case 'shoes':
        return <ShoesScreen focusedShoeId={focusedShoeId} />;
      case 'cadence':
        return <CadenceScreen onBack={() => goBack('programs')} />;
      case 'challenges':
        return <ChallengesScreen onBack={() => goBack()} />;
      case 'community':
        // 궁금증 카드의 "관련 기능으로 이동"이 실제 화면 이동으로 동작하게 연결합니다.
        return <CommunityScreen onNavigate={navigate} onOpenGuide={() => navigate('guide')} />;
      case 'guide':
        return <GuideScreen onBack={() => goBack('community')} onNavigate={navigate} />;
      case 'stats':
        return <MyScreen focus={statsFocus} onOpenCalendar={() => navigate('calendar')} />;
      case 'badges':
        return <BadgesScreen onBack={() => goBack('stats')} />;
      case 'profile':
        return <ProfileScreen onOpenSettings={() => navigate('settings')} />;
      case 'settings':
        return <SettingsScreen onOpenProfile={() => navigate('profile')} />;
      case 'voice':
        return <VoicePickerScreen onBack={() => goBack('settings')} />;
      case 'help':
        return <HelpScreen />;
      default:
        return (
          <HomeScreen
            onNavigate={navigate}
            onOpenRace={(raceId) => openRace(raceId)}
            onOpenShoe={(shoeId) => openShoe(shoeId)}
            onStartTraining={(intent) => {
              setStartRequest((current) => ({ ...intent, nonce: (current?.nonce ?? 0) + 1 }));
            }}
          />
        );
    }
  }, [
    focusedRaceId,
    focusedShoeId,
    goBack,
    navigate,
    openRace,
    openShoe,
    route,
    startRequest,
    statsFocus,
  ]);

  // 앱을 처음 연 사람은 드로어 셸 대신 온보딩을 먼저 봅니다. 로그인 단계는 여기서 끼워 넣습니다.
  if (onboardingRequired) {
    return (
      <OnboardingScreen
        renderLoginStep={({ onDone, onSkip }) => (
          <AuthScreen onDone={() => onDone()} onSkip={onSkip} />
        )}
      />
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      {/* V7: 햄버거와 드로어를 걷어냈습니다. 전역 이동은 아래 탭 하나뿐입니다.
          최상위 화면에는 뒤로가기가 없고, 하위 화면에는 있습니다.
          그 구분이 없으면 "지금 어디쯤인지"를 알 수 없습니다. */}
      <TopBar
        onBack={() => goBack()}
        title={routeTitles[route]}
        topLevel={isTopLevelRoute(route)}
      />
      <View style={styles.body}>{screen}</View>
      {/* 달리는 중에는 탭을 감춥니다. 뛰면서 잘못 누르면 코칭이 끊깁니다. */}
      {tabBarVisible(route) ? (
        <PrimaryTabBar active={destinationForRoute(route)} onSelect={navigate} />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.canvas },
  body: { flex: 1 },
});
