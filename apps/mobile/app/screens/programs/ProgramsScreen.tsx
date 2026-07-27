// 프로그램 화면입니다. 라우팅은 부모가 하고, 이 화면은 onBack만 받습니다.
//
// 여기에는 두 가지가 있습니다.
//  1. "9주 달리기 시작" — 걷기부터 시작해 30분 달리기까지 가는 정해진 프로그램
//  2. 목표 대회 훈련 계획 — 목표 대회를 정한 사람에게만 보이는, 남은 기간에 맞춘 계획
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  Button,
  Card,
  Chip,
  EmptyState,
  ProgressBar,
  SectionHeader,
  SkeletonCard,
  screenStyles,
} from '../../design-system/components';
import {
  borderWidth,
  fontWeight,
  lineHeight,
  palette,
  radius,
  spacing,
  typeScale,
} from '../../design-system/theme';
import { useAppState } from '../../state/AppStateProvider';
import { goalRaceCountdown } from '../../../domains/races/goalRace';
import { useGoalRace } from '../../../domains/races/useGoalRace';
import { sessionShape } from '../../../domains/programs/beginnerProgram';
import { progressSummary, type SessionAttempt } from '../../../domains/programs/progress';
import { guessRaceDistance, type RacePlanDistance } from '../../../domains/programs/racePlan';
import { recentRunning, recentRunningNote } from '../../../domains/programs/recent';
import { formatDuration, type ProgramSession } from '../../../domains/programs/types';
import { usePrograms } from '../../../domains/programs/usePrograms';
import { SessionRunner } from './SessionRunner';
import { PlanPicker } from './PlanPicker';
import { capabilityFromActivities } from '../../../domains/programs/level';
import { TrainingPlanCard } from './TrainingPlanCard';

export type ProgramsScreenProps = {
  /** 부모가 이전 화면으로 돌려보낼 때 씁니다. 없으면 돌아가기 버튼을 감춥니다. */
  onBack?: () => void;
  /** 목표 대회를 정하러 갈 수 있는 화면이 있으면 부모가 넘겨 줍니다. */
  onOpenRaces?: () => void;
};

export function ProgramsScreen({ onBack, onOpenRaces }: ProgramsScreenProps) {
  const { activities, ready: activitiesReady } = useAppState();
  const { goalRace } = useGoalRace();
  const { ready, progress, finishSession, activePlanId, choosePlan } = usePrograms();
  const [running, setRunning] = useState<ProgramSession | undefined>(undefined);
  const [pickedDistance, setPickedDistance] = useState<RacePlanDistance | undefined>(undefined);
  const [openWeeks, setOpenWeeks] = useState(false);

  const summary = useMemo(() => recentRunning(activities), [activities]);
  // 최근 기록에서 수준 판단 재료를 뽑습니다. 기록이 없으면 빈 값이 나옵니다.
  const capability = useMemo(
    () => capabilityFromActivities(activities, new Date()),
    [activities],
  );
  const countdown = useMemo(
    () => (goalRace ? goalRaceCountdown(goalRace.raceDate) : undefined),
    [goalRace],
  );
  const distance = pickedDistance ?? (goalRace ? guessRaceDistance(goalRace.name) : '10k');

  const planInput = useMemo(
    () => ({
      distance,
      weeksLeft: Math.max(1, countdown?.weeks ?? 1),
      weeklyKm: summary.weeklyKm,
      runsPerWeek: summary.runsPerWeek,
      ...(summary.longestKm > 0 ? { longestRecentKm: summary.longestKm } : {}),
    }),
    [countdown?.weeks, distance, summary.longestKm, summary.runsPerWeek, summary.weeklyKm],
  );

  const onFinish = useCallback(
    (attempt: SessionAttempt, markComplete: boolean) => {
      void finishSession(attempt, markComplete);
      setRunning(undefined);
    },
    [finishSession],
  );

  const closeRunner = useCallback(() => {
    setRunning(undefined);
  }, []);

  if (running) {
    return <SessionRunner onClose={closeRunner} onFinish={onFinish} session={running} />;
  }

  const loading = !ready || !activitiesReady;
  const current = progress.current;

  return (
    <ScrollView contentContainerStyle={screenStyles.content} style={screenStyles.root}>
      <SectionHeader
        subtitle="정해진 순서대로 따라 하기만 하면 돼요. 오늘 뭘 할지 고민하지 않아도 괜찮아요."
        title="프로그램"
        {...(onBack ? { action: <Button label="닫기" onPress={onBack} tone="quiet" /> } : {})}
      />

      {loading ? <SkeletonCard accessibilityLabel="프로그램을 불러오는 중이에요" lines={3} /> : null}

      {!loading ? (
        <PlanPicker
          activePlanId={activePlanId}
          capability={capability}
          onChoose={(planId) => {
            void choosePlan(planId);
            setOpenWeeks(false);
          }}
        />
      ) : null}

      {!loading ? (
        <Card elevated style={styles.programCard}>
          <View style={styles.programHead}>
            <View style={styles.programCopy}>
              <Text style={styles.programName}>{progress.program.name}</Text>
              <Text style={styles.programSubtitle}>{progress.program.subtitle}</Text>
            </View>
            <Chip
              label={`${progress.percent}%`}
              tone={progress.finished ? 'positive' : 'accent'}
            />
          </View>

          <ProgressBar
            label={`${progress.totalCount}회차 중 ${progress.completedCount}회차 완료`}
            ratio={progress.ratio}
            tone={progress.finished ? 'positive' : 'accent'}
          />
          <Text style={styles.programBody}>{progressSummary(progress)}</Text>

          {current ? (
            <View style={styles.nextBox}>
              <Text style={styles.nextLabel}>{progress.nextLabel}</Text>
              <Text style={styles.nextSummary}>{current.summary}</Text>
              <Text style={styles.nextShape}>{sessionShape(current)}</Text>
              {progress.currentWeek ? (
                <Text style={styles.nextShape}>
                  {`이번 주는 ${progress.weekDoneCount}일차까지 마쳤어요. ${progress.currentWeek.focus}`}
                </Text>
              ) : null}
              {current.isMilestone && current.encouragement ? (
                <Text style={styles.milestone}>{current.encouragement}</Text>
              ) : null}
              <Button
                label={`${current.title} 시작하기`}
                onPress={() => {
                  setRunning(current);
                }}
                size="lg"
                testID="programs-start-session"
              />
            </View>
          ) : (
            <EmptyState
              body="9주를 모두 끝냈어요. 이제 목표 대회를 하나 정해서 그 날짜에 맞춘 계획을 만들어 봐요."
              title="30분 달리기, 해냈어요"
              {...(onOpenRaces
                ? { actionLabel: '대회 보러 가기', onAction: onOpenRaces }
                : {})}
            />
          )}

          <Text style={styles.restNote}>{progress.program.restNote}</Text>

          <Button
            label={openWeeks ? '주차별 보기 접기' : '9주 전체 보기'}
            onPress={() => {
              setOpenWeeks((value) => !value);
            }}
            tone="secondary"
          />

          {openWeeks ? (
            <View style={styles.weeks}>
              {progress.program.weeks.map((week) => (
                <View key={week.week} style={styles.weekRow}>
                  <Text style={styles.weekTitle}>{week.title}</Text>
                  <Text style={styles.weekFocus}>{week.focus}</Text>
                  {week.sessions.map((session) => (
                    <Text key={session.id} style={styles.weekSession}>
                      {`${session.day}일차 · ${session.summary} (${formatDuration(
                        session.totalSeconds,
                      )})`}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          ) : null}
        </Card>
      ) : null}

      {!loading ? (
        <SectionHeader
          compact
          subtitle="대회 날짜에 맞춰 주차별로 무엇을 할지 정해 드려요."
          title="목표 대회 훈련 계획"
        />
      ) : null}

      {!loading && goalRace && countdown ? (
        <TrainingPlanCard
          basisNote={recentRunningNote(summary)}
          dDayLabel={countdown.dDayLabel}
          distance={distance}
          input={planInput}
          onChangeDistance={setPickedDistance}
          raceName={goalRace.name}
          remainingLabel={countdown.remainingLabel}
        />
      ) : null}

      {!loading && !goalRace ? (
        <EmptyState
          body="목표 대회를 정하면 대회 날짜에 맞춰 계획을 만들어 드려요."
          hint="대회 목록에서 마음에 드는 대회를 골라 목표로 지정하면 돼요."
          title="아직 목표 대회가 없어요"
          {...(onOpenRaces ? { actionLabel: '대회 보러 가기', onAction: onOpenRaces } : {})}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  programCard: {
    gap: spacing.sm,
  },
  programHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  programCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  programName: {
    color: palette.ink,
    fontSize: typeScale.title,
    lineHeight: lineHeight.title,
    fontWeight: fontWeight.heavy,
  },
  programSubtitle: {
    color: palette.inkSoft,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
  },
  programBody: {
    color: palette.inkSoft,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
  },
  nextBox: {
    backgroundColor: palette.surfaceWarm,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  nextLabel: {
    color: palette.accentDark,
    fontSize: typeScale.label,
    lineHeight: lineHeight.label,
    fontWeight: fontWeight.bold,
  },
  nextSummary: {
    color: palette.ink,
    fontSize: typeScale.body,
    lineHeight: lineHeight.body,
    fontWeight: fontWeight.medium,
  },
  nextShape: {
    color: palette.inkSoft,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
  milestone: {
    color: palette.warning,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
  restNote: {
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
  weekTitle: {
    color: palette.ink,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
    fontWeight: fontWeight.bold,
  },
  weekFocus: {
    color: palette.inkSoft,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
  weekSession: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
});
