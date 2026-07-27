// 훈련 화면입니다. 라우팅은 부모가 하고, 이 화면은 onBack만 받습니다.
//
// V4에서 바뀐 것: 예전에는 계획 고르기 · 오늘 제안 · 도전 · 훈련 103개 · 9주 진행 ·
// 대회 계획 · 보조 프로젝트가 **세로로 전부** 쌓여 있었습니다("너무 길다").
// 지금은 네 칸으로 나누고 **한 번에 한 칸만** 펼칩니다.
// 어느 칸이 기본으로 열리는지는 `domains/programs/trainingSections.ts`가 정합니다.
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { capabilityFromActivities, decideLevel } from '../../../domains/programs/level';
import {
  buildWorkoutSession,
  workoutTemplates,
  type WorkoutTemplate,
} from '../../../domains/workouts/library';
import { WorkoutPicker } from './WorkoutPicker';
import { ChallengeBoard } from './ChallengeBoard';
import { TodayCard } from './TodayCard';
import { ProjectBoard } from './ProjectBoard';
import { useProjects } from '../../../domains/projects/useProjects';
import { planPaceSecondsPerKm, planRunToSession } from '../../../domains/programs/racePlanSession';
import {
  defaultOpenSection,
  sectionBadge,
  trainingSections,
  toggleSection,
  type TrainingSectionKey,
} from '../../../domains/programs/trainingSections';
import { activeChallenges } from '../../../domains/challenges/library';
import { TrainingPlanCard } from './TrainingPlanCard';
import { TrainingSection } from './TrainingSection';

export type ProgramsScreenProps = {
  /** 부모가 이전 화면으로 돌려보낼 때 씁니다. 없으면 돌아가기 버튼을 감춥니다. */
  onBack?: () => void;
  /** 목표 대회를 정하러 갈 수 있는 화면이 있으면 부모가 넘겨 줍니다. */
  onOpenRaces?: () => void;
  /**
   * 홈의 "오늘 카드"에서 바로 시작을 눌렀을 때 부모가 넘겨 주는 요청입니다.
   * 같은 것을 다시 눌러도 반응하도록 nonce가 붙습니다.
   */
  startRequest?: { kind: 'plan' | 'workout'; workoutId?: string; nonce: number };
};

export function ProgramsScreen({ onBack, onOpenRaces, startRequest }: ProgramsScreenProps) {
  const { activities, ready: activitiesReady } = useAppState();
  const { goalRace } = useGoalRace();
  const { ready, progress, finishSession, activePlanId, choosePlan } = usePrograms();
  const projects = useProjects();
  const [running, setRunning] = useState<ProgramSession | undefined>(undefined);
  /**
   * 지금 하는 것이 "오늘 한 번만"인지입니다.
   * 일회성 훈련을 계획 진도로 세면 하지도 않은 회차가 끝난 것으로 표시됩니다.
   * 기록은 남기되 진도는 건드리지 않습니다.
   */
  const [runningIsWorkout, setRunningIsWorkout] = useState(false);
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
  // 오늘 한 번만 하는 훈련도 같은 수준 판단을 씁니다. 기준이 두 개면 사용자가 헷갈립니다.
  const level = useMemo(() => decideLevel(undefined, capability).level, [capability]);

  // 대회 계획은 거리로 쓰여 있고 실행 엔진은 시간으로 움직입니다.
  // 그래서 최근 기록에서 1km당 걸린 시간을 뽑아 둡니다. 근거가 없으면 넉넉한 기본값이 나옵니다.
  const pace = useMemo(() => {
    const totals = activities.reduce(
      (sum, record) => ({
        km: sum.km + (record.distanceKm ?? 0),
        minutes: sum.minutes + (record.distanceKm ? record.durationMinutes : 0),
      }),
      { km: 0, minutes: 0 },
    );
    return planPaceSecondsPerKm(totals.km, totals.minutes);
  }, [activities]);

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
      // 일회성 훈련은 기록만 남기고 계획 진도는 그대로 둡니다.
      void finishSession(attempt, runningIsWorkout ? false : markComplete);
      setRunning(undefined);
      setRunningIsWorkout(false);
    },
    [finishSession, runningIsWorkout],
  );

  const closeRunner = useCallback(() => {
    setRunning(undefined);
    setRunningIsWorkout(false);
  }, []);

  const startPlanSession = useCallback(() => {
    if (!progress.current) return;
    setRunningIsWorkout(false);
    setRunning(progress.current);
  }, [progress.current]);

  const startWorkoutTemplate = useCallback((template: WorkoutTemplate) => {
    setRunningIsWorkout(true);
    setRunning(buildWorkoutSession(template));
  }, []);

  // 접었다 펴는 네 칸입니다. 한 번에 하나만 열립니다.
  const [openSection, setOpenSection] = useState<TrainingSectionKey | undefined>(undefined);
  const [sectionDecided, setSectionDecided] = useState(false);
  const challengeCount = useMemo(
    () => (ready ? activeChallenges(activities, new Date()).filter((item) => !item.achieved).length : 0),
    [activities, ready],
  );
  const sectionState = useMemo(
    () => ({
      hasActivePlan: Boolean(progress.current),
      activeChallengeCount: challengeCount,
      hasStartedProject: projects.shown.some((item) => item.doneStepIds.length > 0),
    }),
    [challengeCount, progress.current, projects.shown],
  );

  // 기본으로 열릴 칸은 한 번만 정합니다. 그 뒤로는 사용자가 연 것을 그대로 둡니다.
  useEffect(() => {
    if (sectionDecided || !ready || !activitiesReady) return;
    setSectionDecided(true);
    setOpenSection(defaultOpenSection(sectionState));
  }, [activitiesReady, ready, sectionDecided, sectionState]);

  // 홈의 오늘 카드에서 바로 시작을 눌렀을 때입니다.
  useEffect(() => {
    if (!startRequest || !ready) return;
    if (startRequest.kind === 'plan') {
      startPlanSession();
      return;
    }
    const template = workoutTemplates.find((item) => item.id === startRequest.workoutId);
    if (template) startWorkoutTemplate(template);
    // nonce가 바뀔 때만 다시 실행합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startRequest?.nonce]);

  if (running) {
    return <SessionRunner onClose={closeRunner} onFinish={onFinish} session={running} />;
  }

  const loading = !ready || !activitiesReady;
  const current = progress.current;

  return (
    <ScrollView contentContainerStyle={screenStyles.content} style={screenStyles.root}>
      <SectionHeader
        subtitle="네 칸으로 나눠 뒀어요. 필요한 칸만 열면 돼요."
        title="훈련"
        {...(onBack ? { action: <Button label="닫기" onPress={onBack} tone="quiet" /> } : {})}
      />

      {loading ? <SkeletonCard accessibilityLabel="훈련을 불러오는 중이에요" lines={3} /> : null}

      {/* 오늘 할 것 하나는 칸 밖에 둡니다. 이것만은 열지 않아도 보여야 합니다. */}
      {!loading ? (
        <TodayCard
          activities={activities}
          hasPlanSessionLeft={Boolean(progress.current)}
          onStartPlanSession={startPlanSession}
          onStartWorkout={startWorkoutTemplate}
        />
      ) : null}

      {!loading
        ? trainingSections.map((section) => (
            <TrainingSection
              expanded={openSection === section.key}
              hint={section.hint}
              key={section.key}
              onToggle={() => setOpenSection((value) => toggleSection(value, section.key))}
              title={section.title}
              {...(sectionBadge(section.key, sectionState)
                ? { badge: sectionBadge(section.key, sectionState) as string }
                : {})}
            >
              {section.key === 'plan' ? renderPlanSection() : null}
              {section.key === 'today' ? (
                <WorkoutPicker level={level} onStart={startWorkoutTemplate} />
              ) : null}
              {section.key === 'challenge' ? <ChallengeBoard activities={activities} /> : null}
              {section.key === 'project' && projects.ready ? (
                <ProjectBoard items={projects.shown} onToggleStep={(id) => void projects.toggle(id)} />
              ) : null}
            </TrainingSection>
          ))
        : null}
    </ScrollView>
  );

  function renderPlanSection() {
    return (
      <>
        <PlanPicker
          activePlanId={activePlanId}
          capability={capability}
          onChoose={(planId) => {
            void choosePlan(planId);
            setOpenWeeks(false);
          }}
        />

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

        <SectionHeader
          compact
          subtitle="대회 날짜에 맞춰 주차별로 무엇을 할지 정해 드려요."
          title="목표 대회 훈련 계획"
        />

        {goalRace && countdown ? (
          <TrainingPlanCard
          basisNote={recentRunningNote(summary)}
          dDayLabel={countdown.dDayLabel}
          distance={distance}
          input={planInput}
          onChangeDistance={setPickedDistance}
          onStartRun={(run) => {
            const built = planRunToSession(run, pace.paceSecondsPerKm, pace.fromRecords);
            if (!built.ok) return;
            // 대회 계획 회차도 일회성으로 봅니다. 9주 프로그램 진도와 섞이면 안 됩니다.
            setRunningIsWorkout(true);
            setRunning(built.session);
          }}
          paceFromRecords={pace.fromRecords}
          paceSecondsPerKm={pace.paceSecondsPerKm}
          raceName={goalRace.name}
            remainingLabel={countdown.remainingLabel}
          />
        ) : (
          <EmptyState
            body="목표 대회를 정하면 대회 날짜에 맞춰 계획을 만들어 드려요."
            hint="대회 목록에서 마음에 드는 대회를 골라 목표로 지정하면 돼요."
            title="아직 목표 대회가 없어요"
            {...(onOpenRaces ? { actionLabel: '대회 보러 가기', onAction: onOpenRaces } : {})}
          />
        )}
      </>
    );
  }
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
