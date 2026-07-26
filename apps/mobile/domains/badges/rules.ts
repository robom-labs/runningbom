// 러닝봄의 04시 하루 경계, 스트릭, 주간 달성, 누적 티어를 순수 함수로 계산합니다.
import type { ActivityRecord } from '../activities/types';
import { activityCountsAsMovement } from '../activities/types';

export const BADGE_RULE_VERSION = '2026.07-v1';

export type BadgeDefinition = {
  id: string;
  title: string;
  description: string;
  threshold: number;
  metric:
    | 'coach_count'
    | 'movement_streak'
    | 'weekly_run_weeks'
    | 'run_count'
    | 'run_distance'
    | 'ten_k_count'
    | 'server_event';
  authority: 'local' | 'server';
};

export const badgeDefinitions: BadgeDefinition[] = [
  { id: 'first-coach', title: '첫 코칭', description: '첫 코칭 세션을 마쳤어요.', threshold: 1, metric: 'coach_count', authority: 'local' },
  { id: 'first-run', title: '첫 러닝', description: '첫 러닝을 기록했어요.', threshold: 1, metric: 'run_count', authority: 'local' },
  { id: 'distance-3k', title: '첫 3K', description: '한 번에 3km를 기록했어요.', threshold: 3, metric: 'run_distance', authority: 'local' },
  { id: 'distance-5k', title: '첫 5K', description: '한 번에 5km를 기록했어요.', threshold: 5, metric: 'run_distance', authority: 'local' },
  { id: 'distance-10k', title: '첫 10K', description: '한 번에 10km를 기록했어요.', threshold: 10, metric: 'run_distance', authority: 'local' },
  { id: 'first-race-goal', title: '첫 대회 목표', description: '첫 대회 목표를 공개했어요.', threshold: 1, metric: 'server_event', authority: 'server' },
  { id: 'first-crew', title: '첫 크루', description: '첫 크루 활동을 시작했어요.', threshold: 1, metric: 'server_event', authority: 'server' },
  { id: 'first-post', title: '첫 글', description: '첫 활동글을 직접 게시했어요.', threshold: 1, metric: 'server_event', authority: 'server' },
  { id: 'first-cheer', title: '첫 응원', description: '처음으로 다른 러너를 응원했어요.', threshold: 1, metric: 'server_event', authority: 'server' },
  ...[3, 7, 14, 30, 60, 100, 200, 365].map((days) => ({
    id: `streak-${days}`,
    title: `${days}일의 리듬`,
    description: `${days}일 연속 움직였어요.`,
    threshold: days,
    metric: 'movement_streak' as const,
    authority: 'local' as const,
  })),
  ...[1, 4, 12, 26, 52].map((weeks) => ({
    id: `weekly-${weeks}`,
    title: weeks === 1 ? '첫 주 완성' : `${weeks}주 완성`,
    description: `서로 다른 3일을 달린 주를 ${weeks}회 만들었어요.`,
    threshold: weeks,
    metric: 'weekly_run_weeks' as const,
    authority: 'local' as const,
  })),
  ...[10, 50, 100].map((count) => ({
    id: `run-${count}`,
    title: count === 10 ? '열 번의 출발' : `${count}번의 출발`,
    description: `러닝을 ${count}회 기록했어요.`,
    threshold: count,
    metric: 'run_count' as const,
    authority: 'local' as const,
  })),
  {
    id: 'ten-k-ten-times',
    title: '10K 열 번',
    description: '10km 이상 러닝을 10회 기록했어요.',
    threshold: 10,
    metric: 'ten_k_count',
    authority: 'local',
  },
];

export type StreakSummary = {
  current: number;
  best: number;
  movementDays: string[];
  weeklyRunDays: number;
  weeklyGoalMet: boolean;
  totalRunWeeks: number;
  tier: string;
  freezeCredits: number;
  protectedDays: string[];
};

function dateKeyAtFourAm(value: string | Date, timezoneId = 'Asia/Seoul'): string {
  const input = typeof value === 'string' ? new Date(value) : value;
  const shifted = new Date(input.getTime() - 4 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezoneId,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(shifted);
}

function dayDifference(left: string, right: string): number {
  const leftMs = Date.parse(`${left}T00:00:00Z`);
  const rightMs = Date.parse(`${right}T00:00:00Z`);
  return Math.round((rightMs - leftMs) / 86_400_000);
}

function startOfWeekKey(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  const day = date.getUTCDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  date.setUTCDate(date.getUTCDate() - daysFromMonday);
  return date.toISOString().slice(0, 10);
}

function tierFor(totalRunWeeks: number): string {
  if (totalRunWeeks >= 52) return '러닝마스터';
  if (totalRunWeeks >= 26) return '페이스메이커';
  if (totalRunWeeks >= 12) return '꾸준러너';
  if (totalRunWeeks >= 4) return '러너';
  return '새싹러너';
}

export function calculateStreak(
  activities: ActivityRecord[],
  now = new Date(),
  timezoneId = 'Asia/Seoul',
): StreakSummary {
  const movementDays = [...new Set(
    activities
      .filter(activityCountsAsMovement)
      .map((activity) => dateKeyAtFourAm(activity.completedAt, activity.timezoneId || timezoneId)),
  )].sort();

  const todayKey = dateKeyAtFourAm(now, timezoneId);
  let best = 0;
  let current = 0;
  let freezeCredits = 0;
  const protectedDays: string[] = [];
  let previous: string | undefined;
  for (const day of movementDays) {
    if (!previous) {
      current = 1;
    } else {
      const gap = dayDifference(previous, day);
      for (let missing = 1; missing < gap; missing += 1) {
        const protectedKey = new Date(
          Date.parse(`${previous}T00:00:00Z`) + missing * 86_400_000,
        )
          .toISOString()
          .slice(0, 10);
        if (current > 0 && freezeCredits > 0) {
          freezeCredits -= 1;
          current += 1;
          protectedDays.push(protectedKey);
          best = Math.max(best, current);
        } else {
          current = 0;
        }
      }
      current += 1;
    }
    if (current > 0 && current % 7 === 0) {
      freezeCredits = Math.min(3, freezeCredits + 1);
    }
    best = Math.max(best, current);
    previous = day;
  }

  const latest = movementDays.at(-1);
  if (!latest || dayDifference(latest, todayKey) > 1) {
    const gap = latest ? dayDifference(latest, todayKey) : 0;
    for (let missing = 1; missing <= gap; missing += 1) {
      const protectedKey = new Date(
        Date.parse(`${latest}T00:00:00Z`) + missing * 86_400_000,
      )
        .toISOString()
        .slice(0, 10);
      if (current > 0 && freezeCredits > 0) {
        freezeCredits -= 1;
        current += 1;
        protectedDays.push(protectedKey);
        best = Math.max(best, current);
      } else {
        current = 0;
      }
    }
  } else if (latest && dayDifference(latest, todayKey) === 1) {
    current = Math.max(1, current);
  }

  const currentWeek = startOfWeekKey(todayKey);
  const runDaysByWeek = new Map<string, Set<string>>();
  for (const activity of activities) {
    if (activity.kind !== 'run' || activity.source !== 'COACH_COMPLETED' || activity.durationMinutes < 10) continue;
    const day = dateKeyAtFourAm(activity.completedAt, activity.timezoneId || timezoneId);
    const week = startOfWeekKey(day);
    const days = runDaysByWeek.get(week) ?? new Set<string>();
    days.add(day);
    runDaysByWeek.set(week, days);
  }
  const weeklyRunDays = runDaysByWeek.get(currentWeek)?.size ?? 0;
  const totalRunWeeks = [...runDaysByWeek.values()].filter((days) => days.size >= 3).length;

  return {
    current,
    best,
    movementDays,
    weeklyRunDays,
    weeklyGoalMet: weeklyRunDays >= 3,
    totalRunWeeks,
    tier: tierFor(totalRunWeeks),
    freezeCredits,
    protectedDays,
  };
}

export function unlockedBadges(activities: ActivityRecord[], streak: StreakSummary): BadgeDefinition[] {
  const runCount = activities.filter((activity) => activity.kind === 'run').length;
  const coachCount = activities.filter((activity) => activity.source === 'COACH_COMPLETED').length;
  const maxDistance = Math.max(0, ...activities.map((activity) => activity.distanceKm ?? 0));
  const tenKCount = activities.filter((activity) => (activity.distanceKm ?? 0) >= 10).length;
  return badgeDefinitions.filter((badge) => {
    if (badge.authority === 'server') return false;
    if (badge.metric === 'coach_count') return coachCount >= badge.threshold;
    if (badge.metric === 'movement_streak') return streak.best >= badge.threshold;
    if (badge.metric === 'weekly_run_weeks') return streak.totalRunWeeks >= badge.threshold;
    if (badge.metric === 'run_count') return runCount >= badge.threshold;
    if (badge.metric === 'run_distance') return maxDistance >= badge.threshold;
    if (badge.metric === 'ten_k_count') return tenKCount >= badge.threshold;
    return false;
  });
}

export const streakInternals = {
  dateKeyAtFourAm,
  startOfWeekKey,
};
