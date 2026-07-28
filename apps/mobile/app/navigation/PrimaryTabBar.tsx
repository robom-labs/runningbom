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
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.xs) }]}
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
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
            testID={`tab-${destination.id}`}
          >
            {/* 가운데 달리기만 원형으로 강조합니다.
                강조는 시각적인 것이고, 누르면 준비 화면으로 갑니다. 바로 기록이 시작되지 않습니다. */}
            <View style={destination.emphasized ? styles.emphasis : undefined}>
              <Ionicons
                color={
                  destination.emphasized
                    ? palette.surface
                    : selected
                      ? palette.accentStrong
                      : palette.muted
                }
                name={(selected ? destination.activeIcon : destination.icon) as never}
                size={destination.emphasized ? 26 : 22}
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
    alignItems: 'flex-end',
    paddingTop: spacing.xs,
    backgroundColor: palette.surface,
    borderTopColor: palette.line,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
    paddingHorizontal: 2,
  },
  emphasis: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accentStrong,
    marginBottom: 2,
  },
  label: {
    color: palette.muted,
    fontSize: typeScale.micro,
    fontWeight: fontWeight.bold,
  },
  labelActive: { color: palette.accentStrong },
  pressed: { opacity: 0.6 },
});
