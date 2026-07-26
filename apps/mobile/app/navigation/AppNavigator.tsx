// 다섯 핵심 탭을 휴대전화 하단과 태블릿 왼쪽 레일로 전환합니다.
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  createNavigationContainerRef,
  NavigationContainer,
} from '@react-navigation/native';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWindowDimensions } from 'react-native';

import { CommunityScreen } from '../screens/community/CommunityScreen';
import { ExploreScreen } from '../screens/explore/ExploreScreen';
import { HomeScreen } from '../screens/home/HomeScreen';
import { MyScreen } from '../screens/my/MyScreen';
import { StartScreen } from '../screens/start/StartScreen';
import { appTheme, palette } from '../design-system/theme';
import { useAppState } from '../state/AppStateProvider';
import { raceIdFromDeepLink } from '../../src/races';
import type { ExploreRequest, ExploreSection } from './types';

export type MainTabParamList = {
  홈: undefined;
  탐색: undefined;
  시작: undefined;
  커뮤니티: undefined;
  마이: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const navigationRef = createNavigationContainerRef<MainTabParamList>();

const iconNames: Record<keyof MainTabParamList, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  홈: { active: 'home', inactive: 'home-outline' },
  탐색: { active: 'compass', inactive: 'compass-outline' },
  시작: { active: 'play-circle', inactive: 'play-circle-outline' },
  커뮤니티: { active: 'people', inactive: 'people-outline' },
  마이: { active: 'person', inactive: 'person-outline' },
};

export function AppNavigator() {
  const { width } = useWindowDimensions();
  const { preferences, updatePreferences } = useAppState();
  const [exploreRequest, setExploreRequest] = useState<ExploreRequest>();
  const pendingExploreRef = useRef<ExploreRequest | undefined>(undefined);
  const requestNonceRef = useRef(0);
  const initialUrl = Linking.useLinkingURL();
  const isTablet = width >= 768;

  const openExplore = useCallback(
    (section: ExploreSection, options: { raceId?: string; shoeId?: string } = {}) => {
      requestNonceRef.current += 1;
      const request: ExploreRequest = {
        section,
        ...options,
        nonce: requestNonceRef.current,
      };
      pendingExploreRef.current = request;
      setExploreRequest(request);
      if (navigationRef.isReady()) navigationRef.navigate('탐색');
    },
    [],
  );

  useEffect(() => {
    if (!initialUrl) return;
    const raceId = raceIdFromDeepLink(initialUrl);
    if (raceId) openExplore('대회', { raceId });
  }, [initialUrl, openExplore]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const raceId = response.notification.request.content.data?.raceId;
      if (typeof raceId === 'string') openExplore('대회', { raceId });
    });
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      const raceId = response?.notification.request.content.data?.raceId;
      if (typeof raceId === 'string') openExplore('대회', { raceId });
    });
    return () => subscription.remove();
  }, [openExplore]);

  const initialRoute = useMemo<keyof MainTabParamList>(() => {
    return preferences.lastTab in iconNames
      ? (preferences.lastTab as keyof MainTabParamList)
      : '홈';
  }, [preferences.lastTab]);

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        if (pendingExploreRef.current) navigationRef.navigate('탐색');
      }}
      theme={appTheme}
    >
      <Tab.Navigator
        initialRouteName={initialRoute}
        screenListeners={{
          state: (event) => {
            const state = event.data.state;
            const route = state.routes[state.index];
            if (route?.name) void updatePreferences({ lastTab: route.name });
          },
        }}
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: palette.accentDark,
          tabBarInactiveTintColor: palette.muted,
          tabBarLabelStyle: { fontSize: 12, fontWeight: '800' },
          tabBarStyle: isTablet
            ? { width: 112, backgroundColor: palette.surface, borderRightColor: palette.line }
            : { minHeight: 72, paddingTop: 8, paddingBottom: 10, backgroundColor: palette.surface, borderTopColor: palette.line },
          tabBarItemStyle: route.name === '시작' ? { backgroundColor: palette.accentSoft, borderRadius: 18, margin: 4 } : undefined,
          tabBarPosition: isTablet ? 'left' : 'bottom',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              color={color}
              name={focused ? iconNames[route.name].active : iconNames[route.name].inactive}
              size={route.name === '시작' ? size + 2 : size}
            />
          ),
        })}
      >
        <Tab.Screen name="홈">
          {({ navigation }) => (
            <HomeScreen
              onCommunity={() => navigation.navigate('커뮤니티')}
              onExplore={(section, options) => openExplore(section, options)}
              onProgress={() => navigation.navigate('마이')}
              onStart={() => navigation.navigate('시작')}
            />
          )}
        </Tab.Screen>
        <Tab.Screen name="탐색">
          {() => <ExploreScreen request={exploreRequest} />}
        </Tab.Screen>
        <Tab.Screen name="시작" component={StartScreen} />
        <Tab.Screen name="커뮤니티" component={CommunityScreen} />
        <Tab.Screen name="마이" component={MyScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
