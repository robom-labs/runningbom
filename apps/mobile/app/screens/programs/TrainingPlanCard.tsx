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
  type PlanRun,
  type PlanWeek,
} from '../../../domains/programs/racePlan';
import {
  DEFAULT_PACE_SECONDS_PER_KM,
  planRunToSession,
} from '../../../domains/programs/racePlanSession';
import { formatDuration } from '../../../domains/programs/types';

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
  /**
   * 이번 주 회차를 지금 바로 시작할 때 부릅니다.
   * 없으면 시작 버튼을 그리지 않습니다(예전처럼 보기 전용).
   */
  onStartRun?: (run: PlanRun) => void;
  /**
   * 거리를 시간으로 바꿀 때 쓰는 1km당 초입니다.
   * 계획은 거리로 쓰여 있고 실행 엔진은 시간으로 움직이므로 이 값이 필요합니다.
   */
  paceSecondsPerKm?: number;
  /** 그 속도가 실제 기록에서 나온 값인지입니다. 추정값을 사실처럼 보여 주지 않기 위함입니다. */
  paceFromRecords?: boolean;
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
  onStartRun,
  paceSecondsPerKm = DEFAULT_PACE_SECONDS_PER_KM,
  paceFromRecords = false,
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
        {thisWeek.runs.map((run) => {
          // 계획이 보기 전용으로 끝나지 않도록, 지금 바로 시작할 수 있는지 여기서 판단합니다.
          const runnable = planRunToSession(run, paceSecondsPerKm, paceFromRecords);
          return (
            <View key={run.id} style={styles.runRow}>
              <Text style={styles.runLabel}>{`${run.label} ${run.km}km`}</Text>
              <Text style={styles.runNote}>{run.note}</Text>
              {onStartRun && runnable.ok ? (
                <>
                  <Text style={styles.runPace}>{runnable.paceNote}</Text>
                  <Button
                    label={`지금 시작 (${formatDuration(runnable.session.totalSeconds)})`}
                    onPress={() => onStartRun(run)}
                    size="lg"
                  />
                </>
              ) : null}
              {onStartRun && !runnable.ok ? (
                // 시작할 수 없을 때도 왜 안 되는지 알려 줍니다. 버튼만 사라지면 고장으로 보입니다.
                <Text style={styles.runPace}>{runnable.reason}</Text>
              ) : null}
            </View>
          );
        })}
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
  runPace: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    paddingTop: spacing.xxs,
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
