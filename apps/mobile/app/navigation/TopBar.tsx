// V7 상단 바입니다. **최상위 화면과 하위 화면의 생김새가 다릅니다.**
//
// 예전에는 모든 화면에 같은 헤더가 있었고, 왼쪽에는 항상 햄버거가 있었습니다.
// 그래서 지금 보고 있는 것이 최상위인지 그 안으로 들어온 화면인지 알 수 없었습니다.
// 뒤로 가고 싶은데 뒤로가기가 없고, 대신 메뉴가 열렸습니다.
//
// 이제:
//   최상위 — 왼쪽 비어 있음, 짧은 제목, 오른쪽 액션 최대 하나
//   하위   — 왼쪽 뒤로가기, 현재 제목, 부모 탭은 계속 켜져 있음
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  fontWeight,
  layout,
  lineHeight,
  palette,
  radius,
  spacing,
  typeScale,
} from '../design-system/theme';

export type TopBarProps = {
  title: string;
  /** 최상위 화면이면 뒤로가기가 없습니다. */
  topLevel: boolean;
  onBack?: () => void;
  action?: ReactNode;
};

export function TopBar({ title, topLevel, onBack, action }: TopBarProps) {
  return (
    <View style={styles.bar}>
      {topLevel || !onBack ? (
        // 자리를 비워 두지 않고 폭을 유지합니다. 제목이 화면마다 좌우로 흔들리면 어지럽습니다.
        <View style={styles.slot} />
      ) : (
        <Pressable
          accessibilityLabel="뒤로"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onBack}
          style={({ pressed }) => [styles.slot, styles.button, pressed && styles.pressed]}
          testID="top-bar-back"
        >
          <Ionicons color={palette.ink} name="chevron-back" size={26} />
        </Pressable>
      )}

      <Text
        accessibilityRole="header"
        numberOfLines={1}
        // 최상위는 왼쪽 정렬로 크게, 하위는 가운데 정렬로 작게 둡니다.
        // 같은 모양이면 "들어왔다"는 감각이 생기지 않습니다.
        style={[styles.title, topLevel ? styles.titleTop : styles.titleChild]}
      >
        {title}
      </Text>

      <View style={[styles.slot, styles.actionSlot]}>{action}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    backgroundColor: palette.canvas,
    borderBottomColor: palette.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  slot: { width: layout.touchTarget, height: layout.touchTarget },
  button: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  actionSlot: { width: 'auto', minWidth: layout.touchTarget, alignItems: 'flex-end', justifyContent: 'center' },
  title: {
    flex: 1,
    minWidth: 0,
    color: palette.ink,
    fontWeight: fontWeight.heavy,
    letterSpacing: -0.4,
  },
  titleTop: {
    textAlign: 'left',
    fontSize: typeScale.title,
    lineHeight: lineHeight.title,
  },
  titleChild: {
    textAlign: 'center',
    fontSize: typeScale.titleSmall,
    lineHeight: lineHeight.titleSmall,
  },
  pressed: { opacity: 0.6 },
});
