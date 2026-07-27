// 목표 대회에 맞춘 훈련 계획을 보여 주는 카드입니다.
// 계획 자체는 domains/programs/racePlan.ts의 순수 함수가 만들고, 여기서는 보여 주기만 합니다.
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Chip, ProgressBar } from '../../design-system/components';
import {
  borderWidth,
  fontWeight,
  lineHeight,
  palette,
  radius,
  spacing,
  typeScale,
} from '../../design-system/theme';
import {
  buildTrainingPlan,
  racePlanDistances,
  type RacePlanDistance,
  type RacePlanInput,
  type PlanWeek,
} from '../../../domains/programs/racePlan';

export type TrainingPlanCardProps = {
  raceName: string;
  /** "D-42"처럼 이미 만들어진 표시입니다. */
  dDayLabel: string;
  remainingLabel: string;
  distance: RacePlanDistance;
  onChangeDistance: (distance: RacePlanDistance) => void;
  /** 계획 생성기에 넣을 값입니다. */
  input: RacePlanInput;
  /** 무엇을 근거로 만들었는지 알려 주는 한 줄입니다. */
  basisNote: string;
};

const shortDistanceLabels: Record<RacePlanDistance, string> = {
  '5k': '5킬로',
  '10k': '10킬로',
  half: '하프',
  full: '풀코스',
};

function WeekRow({ week }: { week: PlanWeek }) {
  return (
    <View style={styles.weekRow}>
      <View style={styles.weekHead}>
        <Text style={styles.weekTitle}>{`${week.week}주차`}</Text>
        <Text style={styles.weekPhase}>{week.phaseLabel}</Text>
      </View>
      <Text style={styles.weekRuns}>
        {week.runs.map((run) => `${run.label} ${run.km}km`).join(' · ')}
      </Text>
      <Text style={styles.weekMeta}>{`이번 주 합계 ${week.totalKm}km`}</Text>
    </View>
  );
}

export function TrainingPlanCard({
  raceName,
  dDayLabel,
  remainingLabel,
  distance,
  onChangeDistance,
  input,
  basisNote,
}: TrainingPlanCardProps) {
  const [expanded, setExpanded] = useState(false);
  const plan = useMemo(() => buildTrainingPlan(input), [input]);
  const visibleWeeks = expanded ? plan.weeks : plan.weeks.slice(0, 3);
  const thisWeek = plan.weeks[0] as PlanWeek;

  return (
    <Card elevated style={styles.card}>
      <View style={styles.head}>
        <Text numberOfLines={2} style={styles.raceName}>
          {raceName}
        </Text>
        <Text style={styles.dday}>{dDayLabel}</Text>
      </View>
      <Text style={styles.remaining}>{remainingLabel}</Text>

      <Text style={styles.pickLabel}>목표 거리를 고르면 계획이 다시 만들어져요</Text>
      <View style={styles.chips}>
        {racePlanDistances.map((item) => (
          <Chip
            key={item}
            label={shortDistanceLabels[item]}
            onPress={() => {
              onChangeDistance(item);
            }}
            selected={item === distance}
            tone={item === distance ? 'accent' : 'neutral'}
          />
        ))}
      </View>

      <Text style={styles.basis}>{basisNote}</Text>

      <View style={styles.summaryBox}>
        <Text style={styles.summaryTitle}>{`${plan.distanceLabel} · ${plan.summary.weeksLeft}주 계획`}</Text>
        <Text style={styles.summaryLine}>
          {`일주일에 ${plan.summary.runsPerWeek}번 달려요. 가장 길게 달리는 날은 ${plan.summary.peakWeek}주차의 ${plan.summary.peakLongKm}km예요.`}
        </Text>
        <Text style={styles.summaryLine}>{plan.summary.taperLabel}</Text>
        <ProgressBar
          label={`편한 강도가 전체의 ${Math.round(plan.summary.easyShare * 100)}%예요`}
          ratio={plan.summary.easyShare}
          tone="positive"
        />
      </View>

      {plan.warnings.length > 0 ? (
        <View style={styles.warnings}>
          {plan.warnings.map((warning) => (
            <Text key={warning.id} style={styles.warningText}>
              {`• ${warning.text}`}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.thisWeek}>
        <Text style={styles.thisWeekTitle}>이번 주에 할 것</Text>
        {thisWeek.runs.map((run) => (
          <View key={run.id} style={styles.runRow}>
            <Text style={styles.runLabel}>{`${run.label} ${run.km}km`}</Text>
            <Text style={styles.runNote}>{run.note}</Text>
          </View>
        ))}
        <Text style={styles.weekMeta}>{thisWeek.note}</Text>
      </View>

      <View style={styles.weeks}>
        {visibleWeeks.map((week) => (
          <WeekRow key={week.week} week={week} />
        ))}
      </View>

      {plan.weeks.length > 3 ? (
        <Button
          label={expanded ? '접기' : `${plan.weeks.length}주 전체 보기`}
          onPress={() => {
            setExpanded((value) => !value);
          }}
          tone="secondary"
        />
      ) : null}

      <Text style={styles.disclaimer}>
        계획은 참고용이에요. 아프거나 너무 힘들면 줄이거나 쉬어도 괜찮아요.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  raceName: {
    flex: 1,
    color: palette.ink,
    fontSize: typeScale.titleSmall,
    lineHeight: lineHeight.titleSmall,
    fontWeight: fontWeight.bold,
  },
  dday: {
    color: palette.white,
    backgroundColor: palette.accentStrong,
    borderRadius: radius.pill,
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    fontSize: typeScale.label,
    lineHeight: lineHeight.label,
    fontWeight: fontWeight.bold,
  },
  remaining: {
    color: palette.inkSoft,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
  },
  pickLabel: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  basis: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
  summaryBox: {
    backgroundColor: palette.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.xxs,
  },
  summaryTitle: {
    color: palette.ink,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
    fontWeight: fontWeight.bold,
  },
  summaryLine: {
    color: palette.inkSoft,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
  },
  warnings: {
    backgroundColor: palette.warningSoft,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.xxs,
  },
  warningText: {
    color: palette.warning,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
  thisWeek: {
    gap: spacing.xs,
  },
  thisWeekTitle: {
    color: palette.ink,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
    fontWeight: fontWeight.bold,
  },
  runRow: {
    borderLeftColor: palette.accentSoft,
    borderLeftWidth: 3,
    paddingLeft: spacing.xs,
    gap: spacing.xxs,
  },
  runLabel: {
    color: palette.ink,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
    fontWeight: fontWeight.medium,
  },
  runNote: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
  weeks: {
    gap: spacing.xs,
  },
  weekRow: {
    borderColor: palette.line,
    borderRadius: radius.sm,
    borderWidth: borderWidth.thin,
    padding: spacing.sm,
    gap: spacing.xxs,
  },
  weekHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  weekTitle: {
    color: palette.ink,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
    fontWeight: fontWeight.bold,
  },
  weekPhase: {
    color: palette.accentDark,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    fontWeight: fontWeight.medium,
  },
  weekRuns: {
    color: palette.inkSoft,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
  weekMeta: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
  disclaimer: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
});
