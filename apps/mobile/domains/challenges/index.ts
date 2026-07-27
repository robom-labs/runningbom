// 도전(챌린지) 도메인의 공개 입구입니다. 화면은 여기서만 가져다 씁니다.
export {
  challengeMetricLabels,
  challengeMetricOrder,
  challengeMetricUnits,
  challengeTargetLimits,
  formatChallengeAmount,
  formatChallengeValue,
  isChallenge,
  isChallengeMetric,
  isDayKey,
  type Challenge,
  type ChallengeGoal,
  type ChallengeMetric,
  type ChallengeOrigin,
} from './types';

export {
  builtInChallenges,
  daysBetween,
  formatDayRange,
  monthRange,
  monthlyChallenges,
  raceChallenge,
  raceRunTarget,
  weekRange,
  weeklyChallenges,
  type DayRange,
  type GoalRaceSeed,
} from './catalog';

export {
  activityMatchesGoal,
  challengeCurrent,
  challengeForecast,
  challengeInsight,
  challengePeriod,
  challengeProgress,
  challengeSections,
  pendingCelebration,
  recommendChallenge,
  type ChallengeForecast,
  type ChallengePeriod,
  type ChallengeProgress,
  type ChallengeSections,
  type ChallengeState,
} from './progress';

export {
  MAX_CUSTOM_DAYS,
  MAX_CUSTOM_TITLE,
  defaultCustomInput,
  parseCustomChallenge,
  type CustomChallengeInput,
  type CustomChallengeResult,
} from './custom';

export {
  CHALLENGE_STORE_KEY,
  MAX_CUSTOM_CHALLENGES,
  addCustomChallenge,
  emptyChallengeStore,
  joinChallenge,
  leaveChallenge,
  markCelebrated,
  parseChallengeStore,
  type ChallengeStore,
} from './store';

export { useChallenges, type ChallengesState } from './useChallenges';
