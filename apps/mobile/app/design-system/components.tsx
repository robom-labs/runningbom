// 러닝봄 vNext 화면에서 반복 사용하는 버튼, 카드, 제목 컴포넌트를 제공합니다.
import type { PropsWithChildren, ReactNode } from 'react';
import Constants from 'expo-constants';
import {
  Pressable,
  StyleSheet,
  type StyleProp,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';

import { palette, radius, spacing, typeScale } from './theme';

const isPreviewBuild = Constants.expoConfig?.extra?.preview?.enabled === true;

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'secondary' | 'quiet' | 'danger';
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  onPress,
  disabled = false,
  tone = 'primary',
  accessibilityHint,
  testID,
  style,
}: ButtonProps) {
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        buttonTone[tone],
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <Text style={[styles.buttonLabel, buttonLabelTone[tone]]}>{label}</Text>
    </Pressable>
  );
}

type CardProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}>;

export function Card({ children, style, accessibilityLabel }: CardProps) {
  return (
    <View accessibilityLabel={accessibilityLabel} style={[styles.card, style]}>
      {children}
    </View>
  );
}

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  compact?: boolean;
};

export function SectionHeader({ title, subtitle, action, compact = false }: SectionHeaderProps) {
  return (
    <View style={[styles.sectionHeader, compact && styles.sectionHeaderCompact]}>
      <View style={styles.sectionHeaderCopy}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  tone?: 'neutral' | 'accent' | 'positive' | 'warning';
  accessibilityRole?: 'button' | 'tab';
};

export function Chip({
  label,
  selected = false,
  onPress,
  tone = 'neutral',
  accessibilityRole = 'button',
}: ChipProps) {
  const content = (
    <Text style={[styles.chipLabel, selected && styles.chipLabelSelected, chipLabelTone[tone]]}>
      {label}
    </Text>
  );
  const baseStyle = [styles.chip, chipTone[tone], selected && styles.chipSelected];

  if (!onPress) {
    return <View style={baseStyle}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [...baseStyle, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

type MetricProps = {
  label: string;
  value: string;
  accent?: boolean;
  style?: StyleProp<ViewStyle>;
  valueStyle?: TextStyle;
};

export function Metric({ label, value, accent = false, style, valueStyle }: MetricProps) {
  return (
    <View style={[styles.metric, style]}>
      <Text style={[styles.metricValue, accent && styles.metricValueAccent, valueStyle]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <Text
      accessibilityLabel={isPreviewBuild ? '러닝봄 Preview' : '러닝봄'}
      style={[styles.wordmark, compact && styles.wordmarkCompact]}
    >
      러닝<Text style={styles.wordmarkAccent}>봄</Text>
      {isPreviewBuild ? <Text style={styles.wordmarkPreview}> Preview</Text> : null}
    </Text>
  );
}

const buttonTone = StyleSheet.create({
  primary: { backgroundColor: palette.accent, borderColor: palette.accent },
  secondary: { backgroundColor: palette.surface, borderColor: palette.line },
  quiet: { backgroundColor: palette.surfaceMuted, borderColor: palette.surfaceMuted },
  danger: { backgroundColor: palette.dangerSoft, borderColor: palette.dangerSoft },
});

const buttonLabelTone = StyleSheet.create({
  primary: { color: palette.white },
  secondary: { color: palette.ink },
  quiet: { color: palette.inkSoft },
  danger: { color: palette.danger },
});

const chipTone = StyleSheet.create({
  neutral: { backgroundColor: palette.surfaceMuted },
  accent: { backgroundColor: palette.accentSoft },
  positive: { backgroundColor: palette.positiveSoft },
  warning: { backgroundColor: palette.warningSoft },
});

const chipLabelTone = StyleSheet.create({
  neutral: { color: palette.inkSoft },
  accent: { color: palette.accentDark },
  positive: { color: palette.positive },
  warning: { color: palette.warning },
});

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  buttonLabel: {
    fontSize: typeScale.bodySmall,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.72,
  },
  card: {
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  sectionHeaderCompact: {
    paddingTop: spacing.md,
  },
  sectionHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: typeScale.title,
    lineHeight: 29,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  sectionSubtitle: {
    color: palette.muted,
    fontSize: typeScale.bodySmall,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  chip: {
    minHeight: 48,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: palette.ink,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  chipLabelSelected: {
    color: palette.white,
  },
  metric: {
    minWidth: 0,
    gap: 4,
  },
  metricValue: {
    color: palette.ink,
    fontSize: typeScale.titleSmall,
    fontWeight: '900',
  },
  metricValueAccent: {
    color: palette.accentDark,
  },
  metricLabel: {
    color: palette.muted,
    fontSize: typeScale.caption,
    fontWeight: '600',
  },
  wordmark: {
    color: palette.ink,
    fontSize: 27,
    fontWeight: '900',
    letterSpacing: -1.2,
  },
  wordmarkCompact: {
    fontSize: 22,
  },
  wordmarkAccent: {
    color: palette.accent,
  },
  wordmarkPreview: {
    color: palette.accentDark,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
  },
});
