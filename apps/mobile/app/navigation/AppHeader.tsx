// 모든 화면 위에 놓이는 공통 헤더입니다. 좌상단 햄버거, 가운데 제목, 우측 보조 액션.
import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette, radius, spacing, typeScale } from '../design-system/theme';

type Props = {
  title: string;
  onMenu: () => void;
  action?: ReactNode;
};

export function AppHeader({ title, onMenu, action }: Props) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityLabel="메뉴 열기"
        accessibilityRole="button"
        hitSlop={8}
        onPress={onMenu}
        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        testID="app-header-menu"
      >
        <Ionicons color={palette.ink} name="menu" size={26} />
      </Pressable>
      <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>
        {title}
      </Text>
      <View style={styles.actionSlot}>{action}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    backgroundColor: palette.canvas,
    borderBottomColor: palette.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  title: {
    flex: 1,
    minWidth: 0,
    textAlign: 'center',
    color: palette.ink,
    fontSize: typeScale.titleSmall,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  actionSlot: {
    minWidth: 48,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
});
