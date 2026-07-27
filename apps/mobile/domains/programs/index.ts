// 프로그램 도메인의 공개 입구입니다. 화면은 여기서만 가져다 씁니다.
export {
  formatClock,
  formatDuration,
  formatTick,
  segmentKindLabels,
  type ProgramSession,
  type ProgramWeek,
  type RunProgram,
  type SegmentKind,
  type SegmentRole,
  type SessionSegment,
} from './types';

export {
  COOLDOWN_SECONDS,
  PROGRAM_ID,
  SESSIONS_PER_WEEK,
  WARMUP_SECONDS,
  beginnerProgram,
  findSession,
  sessionShape,
} from './beginnerProgram';

export {
  CUE_LEAD_SECONDS,
  buildTimeline,
  cueText,
  elapsedLabel,
  remainingSegmentsLabel,
  ribbonCells,
  sessionNow,
  sessionTimeline,
  skipToNextSegment,
  type RibbonCell,
  type SessionNow,
  type SessionTimeline,
  type TimelineEntry,
} from './session';

export {
  PASS_RATIO,
  completionRatio,
  judgeSession,
  programProgress,
  progressSummary,
  type ProgramProgress,
  type SessionAttempt,
  type SessionVerdict,
} from './progress';

export {
  MAX_ATTEMPTS,
  PROGRAM_STORE_KEY,
  bestAttempt,
  emptyProgramStore,
  parseProgramStore,
  restartProgram,
  saveAttempt,
  type ProgramStore,
} from './store';

export {
  BEGINNER_GROWTH_RATE,
  CUTBACK_RATE,
  EASY_SHARE_TARGET,
  GROWTH_RATE,
  LONG_RUN_CAP_RATE,
  buildTrainingPlan,
  guessRaceDistance,
  planPhaseLabels,
  planRunLabels,
  racePlanDistanceKm,
  racePlanDistanceLabels,
  racePlanDistances,
  racePlanGuides,
  taperCutRate,
  weekRunKinds,
  type PlanPhase,
  type PlanRun,
  type PlanRunKind,
  type PlanWarning,
  type PlanWeek,
  type RacePlanDistance,
  type RacePlanGuide,
  type RacePlanInput,
  type TrainingPlan,
} from './racePlan';

export {
  RECENT_DAYS,
  emptyRecentRunning,
  recentRunning,
  recentRunningNote,
  type RecentRunning,
} from './recent';

export { usePrograms, type ProgramsState } from './usePrograms';
