// 주간 목표를 횟수·시간·거리 중에서 고르거나 최근 4주 평균으로 추천하는 순수 규칙입니다.
import {
  currentWeekStart,
  recentWeeklyAverage,
  totalsForWeek,
  type PeriodTotals,
} from '../activities/summary';
import type { ActivityRecord } from '../activities/types';

export type GoalMetric = 'sessions' | 'minutes' | 'distance';

export type WeeklyGoal = {
  metric: GoalMetric;
  target: number;
  auto: boolean;
};

export const goalMetricLabels: Record<GoalMetric, string> = {
  sessions: '횟수',
  minutes: '시간',
  distance: '거리',
};

export const goalMetricUnits: Record<GoalMetric, string> = {
  sessions: '회',
  minutes: '분',
  distance: 'km',
};

// ── 실력(러닝 경력) 축 ────────────────────────────────────────────────────────
// 같은 "주 3회"라도 이제 막 시작한 사람과 3년 차에게 뜻이 다릅니다.
// 이력이 없을 때의 출발선과, 이력이 있을 때의 상향 보정 상한을 경력으로 나눕니다.
// 경력은 사용자가 직접 고르는 값이며 건강·능력 판정이 아닙니다.
export const experienceLevels = ['이제 시작', '1년 미만', '1~3년', '3년 이상'] as const;
export type ExperienceLevel = (typeof experienceLevels)[number];

export function isExperienceLevel(value: unknown): value is ExperienceLevel {
  return typeof value === 'string' && (experienceLevels as readonly string[]).includes(value);
}

/** 측정할 이력이 하나도 없을 때 쓰는 경력별 출발선입니다. */
const experienceBaseline: Record<ExperienceLevel, Record<GoalMetric, number>> = {
  '이제 시작': { sessions: 2, minutes: 50, distance: 4 },
  '1년 미만': { sessions: 3, minutes: 70, distance: 8 },
  '1~3년': { sessions: 3, minutes: 90, distance: 15 },
  '3년 이상': { sessions: 4, minutes: 120, distance: 24 },
};

/** 경력을 고르지 않은 사람에게 쓰는 기존 출발선입니다(하위 호환). */
const unsetBaseline: Record<GoalMetric, number> = { sessions: 2, minutes: 60, distance: 6 };

/** 이력이 있어도 경력 대비 과한 목표로 튀지 않게 두는 상한입니다. */
const experienceCeiling: Record<ExperienceLevel, Record<GoalMetric, number>> = {
  '이제 시작': { sessions: 3, minutes: 120, distance: 15 },
  '1년 미만': { sessions: 4, minutes: 180, distance: 25 },
  '1~3년': { sessions: 5, minutes: 300, distance: 45 },
  '3년 이상': { sessions: 7, minutes: 600, distance: 120 },
};

export function baselineGoalTarget(metric: GoalMetric, experience?: ExperienceLevel): number {
  const table = experience ? experienceBaseline[experience] : unsetBaseline;
  return table[metric];
}

/**
 * 경력 미설정 시의 안전값입니다. 이력도 경력도 없을 때만 쓰는 마지막 폴백이며,
 * 실제 화면에서는 되도록 `recommendWeeklyGoal`(이력 우선)이나
 * `startingWeeklyGoal`(이력 → 경력 → 이 값 순)을 통해 결정합니다.
 */
export const defaultWeeklyGoal: WeeklyGoal = { metric: 'sessions', target: 3, auto: true };

export function isWeeklyGoal(value: unknown): value is WeeklyGoal {
  if (!value || typeof value !== 'object') return false;
  const goal = value as Partial<WeeklyGoal>;
  return (
    (goal.metric === 'sessions' || goal.metric === 'minutes' || goal.metric === 'distance') &&
    typeof goal.target === 'number' &&
    Number.isFinite(goal.target) &&
    goal.target > 0
  );
}

export function goalValue(metric: GoalMetric, totals: PeriodTotals): number {
  if (metric === 'sessions') return totals.sessions;
  if (metric === 'minutes') return totals.minutes;
  return totals.distanceKm;
}

// 기록이 많은 지표를 우선 제안합니다. 거리 기록이 충분하면 거리, 없으면 횟수입니다.
export function suggestedMetric(activities: ActivityRecord[]): GoalMetric {
  const runs = activities.filter((activity) => activity.kind === 'run');
  if (runs.length >= 4) {
    const withDistance = runs.filter((activity) => (activity.distanceKm ?? 0) > 0).length;
    if (withDistance / runs.length >= 0.6) return 'distance';
  }
  if (activities.length >= 8) return 'minutes';
  return 'sessions';
}

function roundTarget(metric: GoalMetric, value: number): number {
  if (metric === 'sessions') return Math.max(1, Math.min(7, Math.round(value)));
  if (metric === 'minutes') return Math.max(20, Math.min(600, Math.round(value / 10) * 10));
  return Math.max(2, Math.min(120, Math.round(value * 2) / 2));
}

// 최근 4주 평균에서 10% 이내로만 올려 무리하지 않는 목표를 제안합니다.
// 이력이 없으면 경력(실력) 축의 출발선을, 이력이 있으면 이력을 우선하되 경력으로 상한을 둡니다.
export function recommendWeeklyGoal(
  activities: ActivityRecord[],
  now: Date | number = Date.now(),
  experience?: ExperienceLevel,
): WeeklyGoal {
  const average = recentWeeklyAverage(activities, now);
  const metric = suggestedMetric(activities);
  if (average.measuredWeeks === 0) {
    return { metric, target: baselineGoalTarget(metric, experience), auto: true };
  }
  const base = goalValue(metric, average);
  const stepped = metric === 'sessions' ? Math.min(base + 1, base * 1.34) : base * 1.1;
  // 상한이 이미 하고 있는 양보다 낮으면 상한을 그 양까지 올립니다(잘하고 있는 사람을 깎지 않습니다).
  const ceiling = experience ? Math.max(experienceCeiling[experience][metric], base) : Infinity;
  const target = Math.min(Math.max(stepped, base), ceiling);
  return { metric, target: roundTarget(metric, target), auto: true };
}

/**
 * 저장된 목표가 아직 없을 때 쓰는 첫 목표입니다.
 * 이력이 있으면 이력 기반 추천을, 없으면 경력 출발선을, 둘 다 없으면 `defaultWeeklyGoal`을 씁니다.
 */
export function startingWeeklyGoal(
  activities: ActivityRecord[],
  experience?: ExperienceLevel,
  now: Date | number = Date.now(),
): WeeklyGoal {
  if (activities.length === 0 && !experience) return defaultWeeklyGoal;
  return recommendWeeklyGoal(activities, now, experience);
}

export type WeeklyGoalProgress = {
  metric: GoalMetric;
  value: number;
  target: number;
  ratio: number;
  met: boolean;
  label: string;
  remainingLabel: string;
};

function formatGoalNumber(metric: GoalMetric, value: number): string {
  if (metric === 'distance') return `${Math.round(value * 10) / 10}`;
  return `${Math.round(value)}`;
}

export function weeklyGoalProgress(
  goal: WeeklyGoal,
  totals: PeriodTotals,
): WeeklyGoalProgress {
  const value = goalValue(goal.metric, totals);
  const ratio = goal.target > 0 ? Math.min(1, value / goal.target) : 0;
  const remaining = Math.max(0, goal.target - value);
  const unit = goalMetricUnits[goal.metric];
  return {
    metric: goal.metric,
    value,
    target: goal.target,
    ratio,
    met: value >= goal.target,
    label: `${formatGoalNumber(goal.metric, value)}${unit} / ${formatGoalNumber(goal.metric, goal.target)}${unit}`,
    remainingLabel:
      value >= goal.target
        ? '이번 주 목표를 채웠어요.'
        : `${formatGoalNumber(goal.metric, remaining)}${unit} 남았어요.`,
  };
}

export function currentWeekProgress(
  activities: ActivityRecord[],
  goal: WeeklyGoal,
  now: Date | number = Date.now(),
): WeeklyGoalProgress {
  return weeklyGoalProgress(goal, totalsForWeek(activities, currentWeekStart(now)));
}
