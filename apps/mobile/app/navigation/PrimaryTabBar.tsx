// V7 하단 탭입니다. **전역 내비게이션은 이제 이것 하나뿐입니다.**
//
// 예전에는 좌상단 햄버거(드로어 13+14개)와 하단 탭 5개가 동시에 있었습니다.
// 같은 목적지가 두 곳에 있어서, 어느 쪽이 그 기능의 "진짜 자리"인지 알 수 없었습니다.
// 설정은 드로어에도 있고 탭에도 있었고, 러닝화도 대회도 그랬습니다.
//
// 규칙은 `domains/navigation/destinations.ts`에 순수 함수로 있습니다(테스트가 그걸 봅니다).
import Ionicons from '@expo/vector-icons/Ionicons';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  fontWeight,
  palette,
  spacing,
  typeScale,
} from '../design-system/theme';
import {
  destinations,
  routeForDestination,
  type PrimaryDestination,
} from '../../domains/navigation/destinations';
import type { RouteKey } from './types';

export type PrimaryTabBarProps = {
  /** 지금 불이 들어와 있는 목적지입니다. 하위 화면에서도 부모가 켜져 있습니다. */
  active: PrimaryDestination | undefined;
  onSelect: (route: RouteKey) => void;
};

export const PrimaryTabBar = memo(function PrimaryTabBar({ active, onSelect }: PrimaryTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      accessibilityRole="tablist"
      // 제스처 바가 있는 기기에서 탭이 가려지지 않게 아래 안전 여백을 더합니다.
      style={[styles.bar, { marginBottom: Math.max(insets.bottom, spacing.xs) + 8 }]}
    >
      {destinations.map((destination) => {
        const selected = destination.id === active;
        return (
          <Pressable
            accessibilityLabel={destination.accessibilityLabel}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={destination.id}
            onPress={() => onSelect(routeForDestination(destination.id) as RouteKey)}
            style={({ pressed }) => [styles.tab, selected && styles.tabActive, pressed && styles.pressed]}
            testID={`tab-${destination.id}`}
          >
            <View style={[styles.icon,selected&&styles.iconActive]}>
              <Ionicons
                color={
                  selected
                      ? '#ffffff'
                      : palette.muted
                }
                name={(selected ? destination.activeIcon : destination.icon) as never}
                size={24}
              />
            </View>
            <Text numberOfLines={1} style={[styles.label, selected && styles.labelActive]}>
              {destination.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    padding: 6,
    gap: 2,
    borderRadius: 24,
    minHeight: 78,
    backgroundColor: palette.surface,
    borderColor: '#e7eeeb',
    borderWidth: 1,
    boxShadow: '0 6px 24px rgba(18,58,43,0.09)',
  },
  tab: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 2,
    borderRadius: 16,
  },
  icon: {
    width: 44,
    height: 32,
    borderRadius:12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: fontWeight.bold,
  },
  labelActive: { color: palette.accentStrong },
  tabActive: {backgroundColor:'transparent'},
  iconActive:{backgroundColor:'#0d7667'},
  pressed: { opacity: 0.6 },
});
