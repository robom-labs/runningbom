// 러닝봄 vNext 화면에서 반복 사용하는 버튼, 카드, 제목 컴포넌트를 제공합니다.
// 시각 문법: 면은 Card, 상태 꼬리표는 Chip, 행동은 Button, 안내는 Banner, 비어 있음은 EmptyState.
import { memo, useEffect, useRef, type PropsWithChildren, type ReactNode } from 'react';
import Constants from 'expo-constants';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  type StyleProp,
  Text,
  TextInput,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';

import {
  borderWidth,
  elevation,
  fontWeight,
  layout,
  lineHeight,
  motion,
  palette,
  pressedOpacity,
  radius,
  spacing,
  typeScale,
} from './theme';

const isPreviewBuild = Constants.expoConfig?.extra?.preview?.enabled === true;

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'secondary' | 'quiet' | 'danger';
  /** 화면의 대표 행동에만 씁니다. */
  size?: 'md' | 'lg';
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  onPress,
  disabled = false,
  tone = 'primary',
  size = 'md',
  accessibilityLabel,
  accessibilityHint,
  testID,
  style,
}: ButtonProps) {
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        size === 'lg' && styles.buttonLarge,
        buttonTone[tone],
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <Text
        style={[
          styles.buttonLabel,
          size === 'lg' && styles.buttonLabelLarge,
          buttonLabelTone[tone],
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

type CardProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  /** default = 흰 면, warm = 강조 면, muted = 조용한 면, navy = 대표 행동 면 */
  tone?: 'default' | 'warm' | 'muted' | 'navy';
  /** 떠 있는 느낌이 필요한 카드에만 그림자를 씁니다. */
  elevated?: boolean;
}>;

export function Card({
  children,
  style,
  accessibilityLabel,
  tone = 'default',
  elevated = false,
}: CardProps) {
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[styles.card, cardTone[tone], elevated && elevation.card, style]}
    >
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
  accessibilityLabel?: string;
};

export function Chip({
  label,
  selected = false,
  onPress,
  tone = 'neutral',
  accessibilityRole = 'button',
  accessibilityLabel,
}: ChipProps) {
  const content = (
    <Text style={[styles.chipLabel, chipLabelTone[tone], selected && styles.chipLabelSelected]}>
      {label}
    </Text>
  );
  // 누를 수 있는 칩만 48px 터치 높이를 강제하고, 상태 표시용 칩은 촘촘하게 둡니다.
  const baseStyle = [
    styles.chip,
    onPress ? styles.chipTouchable : null,
    chipTone[tone],
    selected && styles.chipSelected,
  ];

  if (!onPress) {
    return (
      <View accessibilityLabel={accessibilityLabel ?? label} style={baseStyle}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
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

export const Metric = memo(function Metric({
  label,
  value,
  accent = false,
  style,
  valueStyle,
}: MetricProps) {
  return (
    <View accessibilityLabel={`${label} ${value}`} style={[styles.metric, style]}>
      <Text style={[styles.metricValue, accent && styles.metricValueAccent, valueStyle]}>
        {value}
      </Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
});

type ProgressBarProps = {
  ratio: number;
  label?: string;
  tone?: 'accent' | 'positive';
};

export const ProgressBar = memo(function ProgressBar({
  ratio,
  label,
  tone = 'accent',
}: ProgressBarProps) {
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
});

type BannerProps = {
  title: string;
  body?: string;
  tone?: 'info' | 'warning' | 'positive';
};

// 준비 중·읽기 전용처럼 지금 상태를 있는 그대로 알리는 안내 배너입니다.
export const Banner = memo(function Banner({ title, body, tone = 'info' }: BannerProps) {
  return (
    <View accessibilityLiveRegion="polite" style={[styles.banner, bannerTone[tone]]}>
      <Text style={[styles.bannerTitle, bannerLabelTone[tone]]}>{title}</Text>
      {body ? <Text style={styles.bannerBody}>{body}</Text> : null}
    </View>
  );
});

type EmptyStateProps = {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  /** 행동 버튼 아래에 덧붙이는 한 줄 안내입니다. */
  hint?: string;
  tone?: 'warm' | 'muted';
};

// 비어 있는 화면에서 "무엇을 하면 되는지"를 한 카드에 담습니다. 없는 데이터를 지어내지 않습니다.
export function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  hint,
  tone = 'warm',
}: EmptyStateProps) {
  return (
    <Card accessibilityLabel={`${title}. ${body}`} style={styles.emptyState} tone={tone}>
      <Text accessibilityRole="header" style={styles.emptyStateTitle}>
        {title}
      </Text>
      <Text style={styles.emptyStateBody}>{body}</Text>
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} style={styles.emptyStateAction} />
      ) : null}
      {secondaryActionLabel && onSecondaryAction ? (
        <Button label={secondaryActionLabel} onPress={onSecondaryAction} tone="secondary" />
      ) : null}
      {hint ? <Text style={styles.emptyStateHint}>{hint}</Text> : null}
    </Card>
  );
}

type SkeletonProps = {
  height?: number;
  width?: number | `${number}%`;
  rounded?: 'sm' | 'md' | 'pill';
};

// 새 의존성 없이 Animated만으로 만드는 로딩 자리표시자입니다.
export const Skeleton = memo(function Skeleton({
  height = 16,
  width = '100%',
  rounded = 'sm',
}: SkeletonProps) {
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: motion.slow * 2,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.45,
          duration: motion.slow * 2,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[styles.skeleton, { height, width, borderRadius: radius[rounded], opacity: pulse }]}
    />
  );
});

type SkeletonCardProps = {
  lines?: number;
  accessibilityLabel?: string;
};

export function SkeletonCard({
  lines = 3,
  accessibilityLabel = '불러오는 중이에요',
}: SkeletonCardProps) {
  const count = Math.max(1, lines);
  return (
    <Card accessibilityLabel={accessibilityLabel} style={styles.skeletonCard}>
      <Skeleton height={20} width="52%" />
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} height={12} width={index === count - 1 ? '64%' : '100%'} />
      ))}
    </Card>
  );
}

type StepDotsProps = {
  total: number;
  index: number;
};

// 온보딩처럼 단계가 정해진 흐름에서 지금 위치를 알려 줍니다.
export const StepDots = memo(function StepDots({ total, index }: StepDotsProps) {
  return (
    <View accessibilityLabel={`${total}단계 중 ${index + 1}단계`} style={styles.stepDots}>
      {Array.from({ length: Math.max(1, total) }, (_, dot) => (
        <View key={dot} style={[styles.stepDot, dot === index && styles.stepDotActive]} />
      ))}
    </View>
  );
});

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
export const MiniBarChart = memo(function MiniBarChart({
  data,
  accessibilityLabel,
  height = 96,
}: MiniBarChartProps) {
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
});

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

// 모든 화면이 같은 폭·여백·배경을 쓰도록 모아 둔 공통 스크롤 레이아웃입니다.
export const screenStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.canvas },
  content: {
    width: '100%',
    maxWidth: layout.screenMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
});

const buttonTone = StyleSheet.create({
  primary: { backgroundColor: palette.accentStrong, borderColor: palette.accentStrong },
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

const cardTone = StyleSheet.create({
  default: { backgroundColor: palette.surface, borderColor: palette.line },
  warm: { backgroundColor: palette.surfaceWarm, borderColor: palette.accentSoft },
  muted: { backgroundColor: palette.surfaceMuted, borderColor: palette.surfaceMuted },
  navy: { backgroundColor: palette.navy, borderColor: palette.navy },
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
    minHeight: layout.touchTarget,
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  buttonLarge: {
    minHeight: 56,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
  },
  buttonLabel: {
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
  },
  buttonLabelLarge: {
    fontSize: typeScale.body,
    lineHeight: lineHeight.body,
    fontWeight: fontWeight.heavy,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: pressedOpacity,
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
    lineHeight: lineHeight.title,
    fontWeight: fontWeight.heavy,
    letterSpacing: -0.6,
  },
  sectionSubtitle: {
    color: palette.muted,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
    marginTop: spacing.xs,
  },
  chip: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipTouchable: {
    minHeight: layout.touchTarget,
    paddingHorizontal: spacing.md,
  },
  chipSelected: {
    backgroundColor: palette.ink,
  },
  chipLabel: {
    fontSize: typeScale.label,
    lineHeight: lineHeight.label,
    fontWeight: fontWeight.bold,
  },
  chipLabelSelected: {
    color: palette.white,
  },
  metric: {
    minWidth: 0,
    gap: spacing.xxs,
  },
  metricValue: {
    color: palette.ink,
    fontSize: typeScale.titleSmall,
    lineHeight: lineHeight.titleSmall,
    fontWeight: fontWeight.heavy,
  },
  metricValueAccent: {
    color: palette.accentDark,
  },
  metricLabel: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    fontWeight: fontWeight.medium,
  },
  progressWrap: {
    gap: spacing.xxs,
  },
  progressTrack: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: palette.surfaceMuted,
    overflow: 'hidden',
  },
  progressFill: {
    // 진행률 막대는 의미 있는 그래픽이라 배경과 3:1 이상 구분되는 진한 주황을 씁니다.
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: palette.accentStrong,
  },
  progressFillPositive: {
    backgroundColor: palette.positive,
  },
  progressLabel: {
    color: palette.inkSoft,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    fontWeight: fontWeight.bold,
  },
  banner: {
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.xxs,
  },
  bannerTitle: {
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
    fontWeight: fontWeight.heavy,
  },
  bannerBody: {
    color: palette.inkSoft,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
  emptyState: { gap: spacing.xs },
  emptyStateTitle: {
    color: palette.ink,
    fontSize: typeScale.titleSmall,
    lineHeight: lineHeight.titleSmall,
    fontWeight: fontWeight.heavy,
  },
  emptyStateBody: {
    color: palette.inkSoft,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
  },
  emptyStateAction: { marginTop: spacing.xs },
  emptyStateHint: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
  skeleton: { backgroundColor: palette.skeleton },
  skeletonCard: { gap: spacing.sm },
  stepDots: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center' },
  stepDot: {
    width: spacing.xs,
    height: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: palette.line,
  },
  stepDotActive: { width: spacing.xl, backgroundColor: palette.accentStrong },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: layout.touchTarget,
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderWidth: borderWidth.thin,
    borderRadius: radius.md,
    color: palette.ink,
    fontSize: typeScale.body,
    paddingHorizontal: spacing.md,
  },
  searchClear: {
    minHeight: layout.touchTarget,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: palette.surfaceMuted,
    paddingHorizontal: spacing.sm,
  },
  searchClearText: {
    color: palette.inkSoft,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    fontWeight: fontWeight.bold,
  },
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
  chartBarHighlight: { backgroundColor: palette.accentStrong },
  chartLabel: {
    color: palette.muted,
    fontSize: typeScale.micro,
    lineHeight: lineHeight.micro,
    fontWeight: fontWeight.bold,
  },
  chartLabelHighlight: { color: palette.accentDark },
  chartValue: {
    color: palette.inkSoft,
    fontSize: typeScale.micro,
    lineHeight: lineHeight.micro,
    fontWeight: fontWeight.semibold,
  },
  chartEmpty: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
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
    lineHeight: lineHeight.bodySmall,
    fontWeight: fontWeight.bold,
  },
  disclosureMeta: {
    color: palette.muted,
    fontSize: typeScale.micro,
    lineHeight: lineHeight.micro,
    fontWeight: fontWeight.semibold,
    marginTop: spacing.xxs / 2,
  },
  disclosureCaret: {
    color: palette.inkSoft,
    fontSize: typeScale.titleSmall,
    fontWeight: fontWeight.heavy,
    width: spacing.lg,
    textAlign: 'center',
  },
  disclosureBody: {
    gap: spacing.xs,
    borderTopColor: palette.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  wordmark: {
    color: palette.ink,
    fontSize: typeScale.headline,
    lineHeight: lineHeight.headline,
    fontWeight: fontWeight.heavy,
    letterSpacing: -1.2,
  },
  wordmarkCompact: {
    fontSize: typeScale.title,
    lineHeight: lineHeight.title,
  },
  wordmarkAccent: {
    color: palette.accent,
  },
  wordmarkPreview: {
    color: palette.accentDark,
    fontSize: typeScale.caption,
    fontWeight: fontWeight.heavy,
    letterSpacing: 0,
  },
});
