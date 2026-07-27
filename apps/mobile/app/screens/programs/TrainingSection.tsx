// 훈련 탭의 접었다 펴는 칸 하나입니다.
//
// 접혀 있어도 **무엇이 들었는지 한 줄**은 보입니다.
// 접힌 게 빈 상자로 보이면 아무도 열지 않습니다.
import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  borderWidth,
  fontWeight,
  layout,
  lineHeight,
  palette,
  pressedOpacity,
  radius,
  spacing,
  typeScale,
} from '../../design-system/theme';

export type TrainingSectionProps = PropsWithChildren<{
  title: string;
  hint: string;
  /** 오른쪽에 붙는 짧은 상태 말입니다. 없으면 안 붙습니다. */
  badge?: string;
  expanded: boolean;
  onToggle: () => void;
}>;

export function TrainingSection({
  badge,
  children,
  expanded,
  hint,
  onToggle,
  title,
}: TrainingSectionProps) {
  return (
    <View style={[styles.root, expanded && styles.rootOpen]}>
      <Pressable
        accessibilityHint={hint}
        accessibilityLabel={badge ? `${title}, ${badge}` : title}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}
      >
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.hint} numberOfLines={2}>
            {hint}
          </Text>
        </View>
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
        <Text style={styles.caret}>{expanded ? '−' : '+'}</Text>
      </Pressable>
      {expanded ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    overflow: 'hidden',
  },
  rootOpen: { borderColor: palette.accentSoft },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: layout.touchTarget,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pressed: { opacity: pressedOpacity },
  copy: { flex: 1, gap: 2 },
  title: {
    color: palette.ink,
    fontSize: typeScale.titleSmall,
    lineHeight: lineHeight.titleSmall,
    fontWeight: fontWeight.bold,
  },
  hint: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
  badge: {
    backgroundColor: palette.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
  },
  badgeText: {
    color: palette.accentDark,
    fontSize: typeScale.micro,
    fontWeight: fontWeight.bold,
  },
  caret: {
    color: palette.muted,
    fontSize: typeScale.titleSmall,
    fontWeight: fontWeight.bold,
    width: 18,
    textAlign: 'center',
  },
  body: {
    borderTopColor: palette.line,
    borderTopWidth: borderWidth.thin,
    padding: spacing.md,
    gap: spacing.sm,
  },
});
