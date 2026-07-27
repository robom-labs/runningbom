// 오늘 한 번만 할 훈련을 고르는 곳입니다.
//
// 계획과 다른 점:
//   계획은 "가입하고 몇 주 동안 따라가는 것"이고, 여기는 "오늘 하나 골라서 하고 끝"입니다.
//   그래서 진도·완료 표시가 없습니다. 고르면 바로 시작합니다.
//
// 100개가 넘으므로 처음부터 전부 늘어놓지 않습니다.
//   1) 오늘 하기 좋은 몇 개를 먼저 보여 주고
//   2) 더 보고 싶을 때만 갈래별로 폅니다.
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, SectionHeader } from '../../design-system/components';
import {
  borderWidth,
  fontWeight,
  lineHeight,
  palette,
  radius,
  spacing,
  typeScale,
} from '../../design-system/theme';
import type { UserLevelId } from '../../../domains/programs/level';
import { formatClock } from '../../../domains/programs/types';
import {
  buildWorkoutSession,
  suggestWorkouts,
  workoutCategoryLabels,
  workoutsByCategory,
  type WorkoutCategory,
  type WorkoutTemplate,
} from '../../../domains/workouts/library';

export type WorkoutPickerProps = {
  /** 지금 판단된 수준입니다. 이보다 어려운 훈련은 보여 주지 않습니다. */
  level: UserLevelId;
  onStart: (template: WorkoutTemplate) => void;
};

export function WorkoutPicker({ level, onStart }: WorkoutPickerProps) {
  const [openCategory, setOpenCategory] = useState<WorkoutCategory | undefined>(undefined);

  const suggested = useMemo(() => suggestWorkouts(level), [level]);
  const groups = useMemo(() => workoutsByCategory(level), [level]);
  const total = useMemo(
    () => groups.reduce((sum, group) => sum + group.items.length, 0),
    [groups],
  );

  const shown = openCategory
    ? groups.find((group) => group.category === openCategory)?.items ?? []
    : suggested;

  return (
    <View style={styles.root}>
      <SectionHeader
        subtitle={`계획과 상관없이 오늘 하나만 하고 끝나요. 지금 할 수 있는 건 ${total}개예요.`}
        title="오늘 한 번만"
      />

      <View style={styles.categoryRow}>
        {groups.map((group) => {
          const open = openCategory === group.category;
          return (
            <Pressable
              accessibilityLabel={workoutCategoryLabels[group.category]}
              accessibilityRole="button"
              accessibilityState={{ selected: open }}
              key={group.category}
              onPress={() => setOpenCategory(open ? undefined : group.category)}
              style={[styles.categoryChip, open && styles.categoryChipOn]}
            >
              <Text style={[styles.categoryText, open && styles.categoryTextOn]}>
                {workoutCategoryLabels[group.category]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {!openCategory ? (
        <Text style={styles.hint}>오늘 하기 좋은 것부터 보여 드려요. 갈래를 누르면 더 나와요.</Text>
      ) : null}

      {shown.map((template) => (
        <WorkoutCard key={template.id} onStart={onStart} template={template} />
      ))}

      {openCategory ? (
        <Button label="추천만 보기" onPress={() => setOpenCategory(undefined)} tone="quiet" />
      ) : null}
    </View>
  );
}

type WorkoutCardProps = {
  template: WorkoutTemplate;
  onStart: (template: WorkoutTemplate) => void;
};

function WorkoutCard({ onStart, template }: WorkoutCardProps) {
  // 사용자가 가장 먼저 궁금해하는 것은 "얼마나 걸리나"입니다.
  const session = useMemo(() => buildWorkoutSession(template), [template]);

  return (
    <Card style={styles.card}>
      <Text style={styles.category}>{workoutCategoryLabels[template.category]}</Text>
      <Text style={styles.title}>{template.title}</Text>
      <Text style={styles.meta}>
        {`전체 ${formatClock(session.totalSeconds)} · ${session.summary}`}
      </Text>
      <Text style={styles.description}>{template.description}</Text>
      <Button label="이 훈련 시작하기" onPress={() => onStart(template)} size="lg" />
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  categoryChip: {
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderRadius: radius.pill,
    borderWidth: borderWidth.thin,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  categoryChipOn: { backgroundColor: palette.accentSoft, borderColor: palette.accent },
  categoryText: { color: palette.inkSoft, fontSize: typeScale.bodySmall },
  categoryTextOn: { color: palette.accentDark, fontWeight: fontWeight.bold },
  hint: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
  card: { gap: spacing.xxs },
  category: {
    color: palette.accentDark,
    fontSize: typeScale.caption,
    fontWeight: fontWeight.bold,
  },
  title: {
    color: palette.ink,
    fontSize: typeScale.titleSmall,
    lineHeight: lineHeight.titleSmall,
    fontWeight: fontWeight.bold,
  },
  meta: { color: palette.muted, fontSize: typeScale.caption },
  description: {
    color: palette.inkSoft,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
    paddingBottom: spacing.xxs,
  },
});
