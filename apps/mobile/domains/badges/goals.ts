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
export function recommendWeeklyGoal(
  activities: ActivityRecord[],
  now: Date | number = Date.now(),
): WeeklyGoal {
  const average = recentWeeklyAverage(activities, now);
  const metric = suggestedMetric(activities);
  if (average.measuredWeeks === 0) {
    if (metric === 'minutes') return { metric, target: 60, auto: true };
    if (metric === 'distance') return { metric, target: 6, auto: true };
    return { metric: 'sessions', target: 2, auto: true };
  }
  const base = goalValue(metric, average);
  const stepped = metric === 'sessions' ? Math.min(base + 1, base * 1.34) : base * 1.1;
  return { metric, target: roundTarget(metric, Math.max(stepped, base)), auto: true };
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
