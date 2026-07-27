// 화면 맨 아래 다섯 개 탭입니다.
//
// 드로어를 없애지 않습니다. 드로어에는 열다섯 화면이 있고, 그중 자주 가는 다섯을
// 여기로 올려 **항상 보이게** 만드는 것이 이 파일의 전부입니다.
// 규칙은 `domains/navigation/tabs.ts`에 순수 함수로 있습니다(테스트가 그걸 봅니다).
import Ionicons from '@expo/vector-icons/Ionicons';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  borderWidth,
  fontWeight,
  layout,
  palette,
  pressedOpacity,
  spacing,
  typeScale,
} from '../design-system/theme';
import { tabs, type TabKey } from '../../domains/navigation/tabs';
import type { RouteKey } from './types';

export type BottomTabsProps = {
  /** 지금 불이 들어와 있는 탭입니다. 탭이 아닌 화면이면 undefined입니다. */
  active: TabKey | undefined;
  onSelect: (route: RouteKey) => void;
};

export const BottomTabs = memo(function BottomTabs({ active, onSelect }: BottomTabsProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      accessibilityRole="tablist"
      // 제스처 바가 있는 기기에서 탭이 가려지지 않게 아래 안전 여백을 더합니다.
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.xs) }]}
    >
      {tabs.map((tab) => {
        const selected = tab.key === active;
        return (
          <Pressable
            accessibilityLabel={tab.accessibilityLabel}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={tab.key}
            onPress={() => onSelect(tab.key as RouteKey)}
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
            testID={`tab-${tab.key}`}
          >
            <Ionicons
              color={selected ? palette.accentStrong : palette.muted}
              name={(selected ? tab.activeIcon : tab.icon) as never}
              size={22}
            />
            <Text style={[styles.label, selected && styles.labelActive]} numberOfLines={1}>
              {tab.label}
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
    backgroundColor: palette.surface,
    borderTopColor: palette.line,
    borderTopWidth: borderWidth.thin,
    paddingTop: spacing.xs,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    // 누르는 것은 전부 48px 이상입니다(§4.5).
    minHeight: layout.touchTarget,
    paddingHorizontal: spacing.xxs,
  },
  pressed: { opacity: pressedOpacity },
  label: {
    color: palette.muted,
    fontSize: typeScale.micro,
    fontWeight: fontWeight.medium,
  },
  labelActive: {
    color: palette.accentStrong,
    fontWeight: fontWeight.bold,
  },
});
