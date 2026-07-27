// 도전 한 건을 보여 주는 카드입니다. 참가자 수 같은 확인할 수 없는 숫자는 쓰지 않고,
// 이 기기의 기록으로 계산한 값(현재/목표, 진행률, 남은 기간, 해석 한 줄)만 보여 줍니다.
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Chip, ProgressBar } from '../../design-system/components';
import {
  fontWeight,
  lineHeight,
  palette,
  radius,
  spacing,
  typeScale,
} from '../../design-system/theme';
import { formatDayRange } from '../../../domains/challenges/catalog';
import type { ChallengeProgress } from '../../../domains/challenges/progress';

export type ChallengeCardProps = {
  progress: ChallengeProgress;
  joined: boolean;
  /** 크게 보여 주는 추천 카드인지입니다. */
  featured?: boolean;
  onJoin?: (id: string) => void;
  onLeave?: (id: string) => void;
};

export const ChallengeCard = memo(function ChallengeCard({
  progress,
  joined,
  featured = false,
  onJoin,
  onLeave,
}: ChallengeCardProps) {
  const { challenge } = progress;
  const ended = progress.state === 'ended';
  const chipTone = progress.done ? 'positive' : ended ? 'neutral' : 'accent';

  return (
    <Card
      accessibilityLabel={`${challenge.title}. ${progress.amountLabel}. ${progress.insight}`}
      elevated={featured}
      style={styles.card}
      tone={featured ? 'warm' : 'default'}
    >
      <View style={styles.head}>
        <View style={styles.headCopy}>
          <Text accessibilityRole="header" style={[styles.title, featured && styles.titleLarge]}>
            {challenge.title}
          </Text>
          <Text style={styles.summary}>{challenge.summary}</Text>
        </View>
        <Chip label={progress.done ? '완료' : progress.dDayLabel} tone={chipTone} />
      </View>

      <View style={styles.amountRow}>
        <Text style={[styles.amount, featured && styles.amountLarge]}>{progress.amountLabel}</Text>
        <Text style={styles.percent}>{progress.percent}%</Text>
      </View>

      <ProgressBar
        label={`${progress.remainingLabel} · ${formatDayRange(challenge)}`}
        ratio={progress.ratio}
        tone={progress.done ? 'positive' : 'accent'}
      />

      <Text style={[styles.insight, progress.done && styles.insightDone]}>{progress.insight}</Text>

      {joined && onLeave && !ended ? (
        <Button
          accessibilityHint="이 도전에서 빠져요. 기록은 그대로 남아요."
          label="그만두기"
          onPress={() => onLeave(challenge.id)}
          tone="quiet"
        />
      ) : null}
      {!joined && onJoin && !ended ? (
        <Button
          accessibilityHint="이 도전을 내 도전 목록에 넣어요."
          label="도전하기"
          onPress={() => onJoin(challenge.id)}
          size={featured ? 'lg' : 'md'}
        />
      ) : null}
    </Card>
  );
});

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  headCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  title: {
    color: palette.ink,
    fontSize: typeScale.titleSmall,
    lineHeight: lineHeight.titleSmall,
    fontWeight: fontWeight.heavy,
  },
  titleLarge: {
    fontSize: typeScale.title,
    lineHeight: lineHeight.title,
  },
  summary: {
    color: palette.muted,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  amount: {
    color: palette.ink,
    fontSize: typeScale.headline,
    lineHeight: lineHeight.headline,
    fontWeight: fontWeight.heavy,
    letterSpacing: -0.6,
  },
  amountLarge: {
    fontSize: typeScale.display,
    lineHeight: lineHeight.display,
  },
  percent: {
    color: palette.accentDark,
    fontSize: typeScale.titleSmall,
    lineHeight: lineHeight.titleSmall,
    fontWeight: fontWeight.heavy,
  },
  insight: {
    backgroundColor: palette.surfaceMuted,
    borderRadius: radius.sm,
    color: palette.inkSoft,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
    fontWeight: fontWeight.medium,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  insightDone: {
    backgroundColor: palette.positiveSoft,
    color: palette.positive,
  },
});
