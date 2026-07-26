// 러닝봄 vNext 화면에서 반복 사용하는 버튼, 카드, 제목 컴포넌트를 제공합니다.
import type { PropsWithChildren, ReactNode } from 'react';
import Constants from 'expo-constants';
import {
  Pressable,
  StyleSheet,
  type StyleProp,
  Text,
  TextInput,
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

type ProgressBarProps = {
  ratio: number;
  label?: string;
  tone?: 'accent' | 'positive';
};

export function ProgressBar({ ratio, label, tone = 'accent' }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  return (
    <View style={styles.progressWrap}>
      <View
        accessibilityLabel={label ?? `진행률 ${Math.round(clamped * 100)}퍼센트`}
        accessibilityRole="progressbar"
        style={styles.progressTrack}
      >
        <View
          style={[
            styles.progressFill,
            { width: `${Math.round(clamped * 100)}%` },
            tone === 'positive' && styles.progressFillPositive,
          ]}
        />
      </View>
      {label ? <Text style={styles.progressLabel}>{label}</Text> : null}
    </View>
  );
}

type BannerProps = {
  title: string;
  body?: string;
  tone?: 'info' | 'warning' | 'positive';
};

// 준비 중·읽기 전용처럼 지금 상태를 있는 그대로 알리는 안내 배너입니다.
export function Banner({ title, body, tone = 'info' }: BannerProps) {
  return (
    <View accessibilityLiveRegion="polite" style={[styles.banner, bannerTone[tone]]}>
      <Text style={[styles.bannerTitle, bannerLabelTone[tone]]}>{title}</Text>
      {body ? <Text style={styles.bannerBody}>{body}</Text> : null}
    </View>
  );
}

type SearchFieldProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  accessibilityLabel: string;
};

// 검색 입력과 지우기 버튼을 한 줄로 묶습니다. 터치 영역은 48px 이상입니다.
export function SearchField({
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
}: SearchFieldProps) {
  return (
    <View style={styles.searchRow}>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.muted}
        returnKeyType="search"
        style={styles.searchInput}
        value={value}
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityLabel="검색어 지우기"
          accessibilityRole="button"
          onPress={() => onChangeText('')}
          style={({ pressed }) => [styles.searchClear, pressed && styles.pressed]}
        >
          <Text style={styles.searchClearText}>지우기</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export type BarDatum = {
  key: string;
  label: string;
  ratio: number;
  valueLabel: string;
  highlight?: boolean;
};

type MiniBarChartProps = {
  data: BarDatum[];
  accessibilityLabel: string;
  height?: number;
};

// 외부 차트 라이브러리 없이 View 높이만으로 그리는 막대 그래프입니다.
export function MiniBarChart({ data, accessibilityLabel, height = 96 }: MiniBarChartProps) {
  const hasValue = data.some((item) => item.ratio > 0);
  return (
    <View accessibilityLabel={accessibilityLabel} style={styles.chartWrap}>
      <View style={[styles.chartPlot, { height }]}>
        {data.map((item) => {
          const clamped = Math.max(0, Math.min(1, Number.isFinite(item.ratio) ? item.ratio : 0));
          // 값이 0보다 크면 최소 4px는 보이게 해 존재를 알립니다.
          const barHeight = clamped > 0 ? Math.max(4, Math.round(clamped * height)) : 2;
          return (
            <View key={item.key} style={styles.chartColumn}>
              <View
                style={[
                  styles.chartBar,
                  { height: barHeight },
                  clamped === 0 && styles.chartBarEmpty,
                  item.highlight ? styles.chartBarHighlight : null,
                ]}
              />
            </View>
          );
        })}
      </View>
      <View style={styles.chartAxis}>
        {data.map((item) => (
          <View key={item.key} style={styles.chartColumn}>
            <Text
              numberOfLines={1}
              style={[styles.chartLabel, item.highlight ? styles.chartLabelHighlight : null]}
            >
              {item.label}
            </Text>
            <Text numberOfLines={1} style={styles.chartValue}>
              {item.valueLabel}
            </Text>
          </View>
        ))}
      </View>
      {!hasValue ? <Text style={styles.chartEmpty}>아직 표시할 기록이 없어요.</Text> : null}
    </View>
  );
}

type DisclosureProps = PropsWithChildren<{
  title: string;
  meta?: string;
  expanded: boolean;
  onToggle: () => void;
  badge?: ReactNode;
}>;

// 질문을 눌러 답변을 펼치는 아코디언 행입니다.
export function Disclosure({ title, meta, expanded, onToggle, badge, children }: DisclosureProps) {
  return (
    <View style={styles.disclosure}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={({ pressed }) => [styles.disclosureHeader, pressed && styles.pressed]}
      >
        <View style={styles.disclosureCopy}>
          <Text style={styles.disclosureTitle}>{title}</Text>
          {meta ? <Text style={styles.disclosureMeta}>{meta}</Text> : null}
        </View>
        {badge}
        <Text style={styles.disclosureCaret}>{expanded ? '−' : '+'}</Text>
      </Pressable>
      {expanded ? <View style={styles.disclosureBody}>{children}</View> : null}
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

const bannerTone = StyleSheet.create({
  info: { backgroundColor: palette.surfaceMuted },
  warning: { backgroundColor: palette.warningSoft },
  positive: { backgroundColor: palette.positiveSoft },
});

const bannerLabelTone = StyleSheet.create({
  info: { color: palette.ink },
  warning: { color: palette.warning },
  positive: { color: palette.positive },
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
  progressWrap: {
    gap: 6,
  },
  progressTrack: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: palette.surfaceMuted,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: palette.accent,
  },
  progressFillPositive: {
    backgroundColor: palette.positive,
  },
  progressLabel: {
    color: palette.inkSoft,
    fontSize: typeScale.caption,
    fontWeight: '800',
  },
  banner: {
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 4,
  },
  bannerTitle: {
    fontSize: typeScale.bodySmall,
    fontWeight: '900',
  },
  bannerBody: {
    color: palette.inkSoft,
    fontSize: typeScale.caption,
    lineHeight: 18,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: radius.md,
    color: palette.ink,
    fontSize: typeScale.body,
    paddingHorizontal: spacing.md,
  },
  searchClear: {
    minHeight: 48,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: palette.surfaceMuted,
    paddingHorizontal: spacing.sm,
  },
  searchClearText: { color: palette.inkSoft, fontSize: typeScale.caption, fontWeight: '800' },
  chartWrap: { gap: spacing.xs },
  chartPlot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xxs,
  },
  chartAxis: { flexDirection: 'row', gap: spacing.xxs },
  chartColumn: { flex: 1, minWidth: 0, alignItems: 'center' },
  chartBar: {
    width: '82%',
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
    backgroundColor: palette.accentSoft,
  },
  chartBarEmpty: { backgroundColor: palette.line },
  chartBarHighlight: { backgroundColor: palette.accent },
  chartLabel: { color: palette.muted, fontSize: 11, fontWeight: '800' },
  chartLabelHighlight: { color: palette.accentDark },
  chartValue: { color: palette.inkSoft, fontSize: 10, fontWeight: '700', marginTop: 2 },
  chartEmpty: { color: palette.muted, fontSize: typeScale.caption, lineHeight: 18 },
  disclosure: {
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  disclosureHeader: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  disclosureCopy: { flex: 1, minWidth: 0 },
  disclosureTitle: {
    color: palette.ink,
    fontSize: typeScale.bodySmall,
    lineHeight: 21,
    fontWeight: '800',
  },
  disclosureMeta: { color: palette.muted, fontSize: 11, fontWeight: '700', marginTop: 2 },
  disclosureCaret: { color: palette.muted, fontSize: 20, fontWeight: '900', width: 20, textAlign: 'center' },
  disclosureBody: {
    gap: spacing.xs,
    borderTopColor: palette.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
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
