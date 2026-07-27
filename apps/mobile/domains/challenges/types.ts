// 챌린지(도전) 한 건의 모양과 저장 값 검증입니다.
// 서버가 없으므로 참가자 수처럼 확인할 수 없는 숫자는 아예 다루지 않습니다.
// 진행률은 오직 이 기기에 쌓인 활동 기록(domains/activities)으로만 계산합니다.
import type { ActivityKind } from '../activities/types';

/** 무엇을 세는 도전인지입니다. */
export type ChallengeMetric = 'distance' | 'sessions' | 'minutes' | 'activeDays';

export const challengeMetricLabels: Record<ChallengeMetric, string> = {
  distance: '거리',
  sessions: '횟수',
  minutes: '시간',
  activeDays: '움직인 날',
};

export const challengeMetricUnits: Record<ChallengeMetric, string> = {
  distance: 'km',
  sessions: '번',
  minutes: '분',
  activeDays: '일',
};

/** 사용자가 직접 만들 때 고르는 순서입니다. */
export const challengeMetricOrder: ChallengeMetric[] = [
  'distance',
  'sessions',
  'minutes',
  'activeDays',
];

/** 종류별로 사람이 넣을 수 있는 목표 값의 상한입니다. 오타로 터무니없는 값이 저장되지 않게 막습니다. */
export const challengeTargetLimits: Record<ChallengeMetric, number> = {
  distance: 1_000,
  sessions: 500,
  minutes: 20_000,
  activeDays: 366,
};

export type ChallengeGoal = {
  metric: ChallengeMetric;
  target: number;
  /** 이 시간(분) 이상인 기록만 셉니다. sessions에만 씁니다. */
  minMinutes?: number;
  /** 이 종류만 셉니다. 비워 두면 모든 기록을 셉니다. */
  kinds?: ActivityKind[];
};

/** builtin = 러닝봄이 매달·매주 자동으로 여는 도전, race = 목표 대회 준비, custom = 사용자가 만든 도전 */
export type ChallengeOrigin = 'builtin' | 'race' | 'custom';

export type Challenge = {
  id: string;
  title: string;
  /** 카드에 한 줄로 붙는 설명입니다. */
  summary: string;
  /** 한국 날짜 기준 시작일입니다(YYYY-MM-DD). */
  startDay: string;
  /** 한국 날짜 기준 마지막 날입니다. 이 날까지 포함해서 셉니다. */
  endDay: string;
  goal: ChallengeGoal;
  origin: ChallengeOrigin;
};

const dayPattern = /^\d{4}-\d{2}-\d{2}$/;

export function isDayKey(value: unknown): value is string {
  if (typeof value !== 'string' || !dayPattern.test(value)) return false;
  return Number.isFinite(Date.parse(`${value}T00:00:00Z`));
}

export function isChallengeMetric(value: unknown): value is ChallengeMetric {
  return (
    value === 'distance' || value === 'sessions' || value === 'minutes' || value === 'activeDays'
  );
}

function isActivityKindList(value: unknown): value is ActivityKind[] {
  return (
    Array.isArray(value) &&
    value.every((kind) => kind === 'run' || kind === 'walk' || kind === 'recovery')
  );
}

export function isChallengeGoal(value: unknown): value is ChallengeGoal {
  if (!value || typeof value !== 'object') return false;
  const goal = value as Partial<ChallengeGoal>;
  if (!isChallengeMetric(goal.metric)) return false;
  if (typeof goal.target !== 'number' || !Number.isFinite(goal.target) || goal.target <= 0) {
    return false;
  }
  if (goal.target > challengeTargetLimits[goal.metric]) return false;
  if (goal.minMinutes !== undefined) {
    if (typeof goal.minMinutes !== 'number' || !Number.isFinite(goal.minMinutes)) return false;
    if (goal.minMinutes < 0 || goal.minMinutes > 600) return false;
  }
  if (goal.kinds !== undefined && !isActivityKindList(goal.kinds)) return false;
  return true;
}

export function isChallenge(value: unknown): value is Challenge {
  if (!value || typeof value !== 'object') return false;
  const challenge = value as Partial<Challenge>;
  return (
    typeof challenge.id === 'string' &&
    challenge.id.length > 0 &&
    typeof challenge.title === 'string' &&
    challenge.title.length > 0 &&
    typeof challenge.summary === 'string' &&
    isDayKey(challenge.startDay) &&
    isDayKey(challenge.endDay) &&
    challenge.startDay <= challenge.endDay &&
    (challenge.origin === 'builtin' ||
      challenge.origin === 'race' ||
      challenge.origin === 'custom') &&
    isChallengeGoal(challenge.goal)
  );
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** 화면 어디에서나 같은 표기를 쓰도록 값 + 단위를 한 곳에서 만듭니다. */
export function formatChallengeValue(metric: ChallengeMetric, value: number): string {
  const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
  if (metric === 'distance') return `${round1(safe).toFixed(1)}km`;
  if (metric === 'minutes') return `${Math.round(safe)}분`;
  if (metric === 'sessions') return `${Math.round(safe)}번`;
  return `${Math.round(safe)}일`;
}

/** "12.4km / 30km"처럼 현재/목표를 한 줄로 씁니다. */
export function formatChallengeAmount(
  metric: ChallengeMetric,
  current: number,
  target: number,
): string {
  return `${formatChallengeValue(metric, current)} / ${formatChallengeValue(metric, target)}`;
}
