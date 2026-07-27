// 오늘 뭘 하면 좋은지 하나만 보여 주는 곳입니다.
//
// 계획 40개, 훈련 103개, 도전 40개가 있습니다. 고를 것이 많은 건 좋지만,
// 나가기 직전에 고민이 길어지면 그냥 안 나갑니다. 그래서 오늘은 하나만 보여 줍니다.
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card } from '../../design-system/components';
import { fontWeight, lineHeight, palette, spacing, typeScale } from '../../design-system/theme';
import type { ActivityRecord } from '../../../domains/activities/types';
import { suggestToday } from '../../../domains/today/suggest';
import {
  buildWorkoutSession,
  workoutTemplates,
  type WorkoutTemplate,
} from '../../../domains/workouts/library';
import { formatClock } from '../../../domains/programs/types';

export type TodayCardProps = {
  activities: ActivityRecord[];
  /** 하고 있는 계획에 아직 남은 회차가 있는지입니다. */
  hasPlanSessionLeft: boolean;
  /** 계획의 다음 회차를 시작할 때 부릅니다. */
  onStartPlanSession: () => void;
  /** 오늘 한 번만 하는 훈련을 시작할 때 부릅니다. */
  onStartWorkout: (template: WorkoutTemplate) => void;
  now?: Date;
};

export function TodayCard({
  activities,
  hasPlanSessionLeft,
  now,
  onStartPlanSession,
  onStartWorkout,
}: TodayCardProps) {
  const at = now ?? new Date();
  const suggestion = useMemo(
    () => suggestToday({ activities, now: at, hasPlanSessionLeft }),
    // 시각은 초 단위로 바뀌므로 날짜만 열쇠로 씁니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activities, hasPlanSessionLeft, at.toISOString().slice(0, 10)],
  );

  const template = useMemo(
    () =>
      suggestion.workoutId
        ? workoutTemplates.find((item) => item.id === suggestion.workoutId)
        : undefined,
    [suggestion.workoutId],
  );

  const minutes = useMemo(
    () => (template ? formatClock(buildWorkoutSession(template).totalSeconds) : undefined),
    [template],
  );

  return (
    <Card elevated style={styles.card} tone={suggestion.kind === 'rest' ? 'default' : 'warm'}>
      <Text style={styles.eyebrow}>오늘</Text>
      <Text style={styles.title}>{suggestion.title}</Text>
      <Text style={styles.reason}>{suggestion.reason}</Text>

      {suggestion.kind === 'planSession' ? (
        <Button label="오늘 회차 시작하기" onPress={onStartPlanSession} size="lg" />
      ) : null}

      {template ? (
        <Button
          label={minutes ? `${template.title} 시작하기 (${minutes})` : `${template.title} 시작하기`}
          onPress={() => onStartWorkout(template)}
          size="lg"
        />
      ) : null}

      {suggestion.kind === 'rest' ? (
        <Text style={styles.restNote}>
          쉬는 날에도 앱을 켜 주셔서 좋아요. 내일 만나요.
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.xs },
  eyebrow: {
    color: palette.accentDark,
    fontSize: typeScale.caption,
    fontWeight: fontWeight.bold,
  },
  title: {
    color: palette.ink,
    fontSize: typeScale.title,
    lineHeight: lineHeight.title,
    fontWeight: fontWeight.heavy,
  },
  reason: {
    color: palette.inkSoft,
    fontSize: typeScale.body,
    lineHeight: lineHeight.body,
    paddingBottom: spacing.xxs,
  },
  restNote: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
});
