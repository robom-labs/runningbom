// 러닝봄의 04시 하루 경계, 스트릭, 주간 달성, 누적 티어를 순수 함수로 계산합니다.
import type { ActivityRecord } from '../activities/types';
import { activityCountsAsMovement } from '../activities/types';

export const BADGE_RULE_VERSION = '2026.07-v2';

export type BadgeCategory =
  | 'first'
  | 'streak'
  | 'consistency'
  | 'distance'
  | 'duration'
  | 'timeOfDay'
  | 'recovery'
  | 'race'
  | 'community';

export const badgeCategoryOrder: BadgeCategory[] = [
  'first',
  'streak',
  'consistency',
  'distance',
  'duration',
  'timeOfDay',
  'recovery',
  'race',
  'community',
];

export const badgeCategoryLabels: Record<BadgeCategory, string> = {
  first: '첫 경험',
  streak: '연속성',
  consistency: '꾸준함',
  distance: '거리',
  duration: '시간',
  timeOfDay: '시간대',
  recovery: '회복',
  race: '대회',
  community: '커뮤니티',
};

export type BadgeMetric =
  | 'coach_count'
  | 'movement_streak'
  | 'weekly_run_weeks'
  | 'run_count'
  | 'run_distance'
  | 'ten_k_count'
  | 'total_distance'
  | 'total_minutes'
  | 'morning_run_count'
  | 'night_run_count'
  | 'recovery_count'
  | 'interval_count'
  | 'race_interest'
  | 'server_event';

export type BadgeDefinition = {
  id: string;
  title: string;
  description: string;
  threshold: number;
  metric: BadgeMetric;
  authority: 'local' | 'server';
  category: BadgeCategory;
};

export const badgeDefinitions: BadgeDefinition[] = [
  { id: 'first-coach', title: '첫 코칭', description: '첫 코칭 세션을 마쳤어요.', threshold: 1, metric: 'coach_count', authority: 'local', category: 'first' },
  { id: 'first-run', title: '첫 러닝', description: '첫 러닝을 기록했어요.', threshold: 1, metric: 'run_count', authority: 'local', category: 'first' },
  { id: 'first-interval', title: '첫 인터벌', description: '인터벌 코칭을 한 번 마쳤어요.', threshold: 1, metric: 'interval_count', authority: 'local', category: 'first' },
  { id: 'distance-3k', title: '첫 3K', description: '한 번에 3km를 기록했어요.', threshold: 3, metric: 'run_distance', authority: 'local', category: 'first' },
  { id: 'distance-5k', title: '첫 5K', description: '한 번에 5km를 기록했어요.', threshold: 5, metric: 'run_distance', authority: 'local', category: 'first' },
  { id: 'distance-10k', title: '첫 10K', description: '한 번에 10km를 기록했어요.', threshold: 10, metric: 'run_distance', authority: 'local', category: 'first' },
  { id: 'first-race-goal', title: '첫 대회 목표', description: '첫 대회 목표를 공개했어요.', threshold: 1, metric: 'server_event', authority: 'server', category: 'race' },
  { id: 'first-crew', title: '첫 크루', description: '첫 크루 활동을 시작했어요.', threshold: 1, metric: 'server_event', authority: 'server', category: 'community' },
  { id: 'first-post', title: '첫 글', description: '첫 활동글을 직접 게시했어요.', threshold: 1, metric: 'server_event', authority: 'server', category: 'community' },
  { id: 'first-cheer', title: '첫 응원', description: '처음으로 다른 러너를 응원했어요.', threshold: 1, metric: 'server_event', authority: 'server', category: 'community' },
  ...[3, 7, 14, 30, 60, 100, 200, 365].map((days) => ({
    id: `streak-${days}`,
    title: `${days}일의 리듬`,
    description: `${days}일 연속 움직였어요.`,
    threshold: days,
    metric: 'movement_streak' as const,
    authority: 'local' as const,
    category: 'streak' as const,
  })),
  ...[1, 4, 12, 26, 52].map((weeks) => ({
    id: `weekly-${weeks}`,
    title: weeks === 1 ? '첫 주 완성' : `${weeks}주 완성`,
    description: `서로 다른 3일을 달린 주를 ${weeks}회 만들었어요.`,
    threshold: weeks,
    metric: 'weekly_run_weeks' as const,
    authority: 'local' as const,
    category: 'consistency' as const,
  })),
  ...[10, 50, 100].map((count) => ({
    id: `run-${count}`,
    title: count === 10 ? '열 번의 출발' : `${count}번의 출발`,
    description: `러닝을 ${count}회 기록했어요.`,
    threshold: count,
    metric: 'run_count' as const,
    authority: 'local' as const,
    category: 'consistency' as const,
  })),
  {
    id: 'ten-k-ten-times',
    title: '10K 열 번',
    description: '10km 이상 러닝을 10회 기록했어요.',
    threshold: 10,
    metric: 'ten_k_count',
    authority: 'local',
    category: 'distance',
  },
  ...[10, 50, 100, 250, 500, 1_000].map((km) => ({
    id: `total-distance-${km}`,
    title: `누적 ${km}km`,
    description: `기록한 거리의 합이 ${km}km를 넘었어요.`,
    threshold: km,
    metric: 'total_distance' as const,
    authority: 'local' as const,
    category: 'distance' as const,
  })),
  ...[300, 600, 1_800, 3_600].map((minutes) => ({
    id: `total-minutes-${minutes}`,
    title: `누적 ${Math.round(minutes / 60)}시간`,
    description: `활동 시간의 합이 ${Math.round(minutes / 60)}시간을 넘었어요.`,
    threshold: minutes,
    metric: 'total_minutes' as const,
    authority: 'local' as const,
    category: 'duration' as const,
  })),
  ...[1, 10, 30].map((count) => ({
    id: `morning-run-${count}`,
    title: count === 1 ? '첫 아침런' : `아침런 ${count}회`,
    description: `한국 시간 새벽 4시부터 오전 9시 사이에 마친 활동이 ${count}회예요.`,
    threshold: count,
    metric: 'morning_run_count' as const,
    authority: 'local' as const,
    category: 'timeOfDay' as const,
  })),
  ...[1, 10, 30].map((count) => ({
    id: `night-run-${count}`,
    title: count === 1 ? '첫 야간런' : `야간런 ${count}회`,
    description: `한국 시간 저녁 8시부터 새벽 3시 사이에 마친 활동이 ${count}회예요.`,
    threshold: count,
    metric: 'night_run_count' as const,
    authority: 'local' as const,
    category: 'timeOfDay' as const,
  })),
  ...[1, 5, 20].map((count) => ({
    id: `recovery-${count}`,
    title: count === 1 ? '첫 회복 루틴' : `회복 루틴 ${count}회`,
    description: `회복 활동을 ${count}회 기록했어요.`,
    threshold: count,
    metric: 'recovery_count' as const,
    authority: 'local' as const,
    category: 'recovery' as const,
  })),
  ...[1, 5].map((count) => ({
    id: `race-interest-${count}`,
    title: count === 1 ? '첫 대회 관심' : `대회 관심 ${count}개`,
    description: `참가를 살펴본 대회를 ${count}개 저장했어요.`,
    threshold: count,
    metric: 'race_interest' as const,
    authority: 'local' as const,
    category: 'race' as const,
  })),
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

export type BadgeContext = {
  interestedRaceCount?: number;
};

function hourInKst(value: string, timezoneId = 'Asia/Seoul'): number {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return -1;
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezoneId,
    hour: '2-digit',
    hour12: false,
  }).format(parsed);
  const hour = Number(formatted);
  return Number.isFinite(hour) ? hour % 24 : -1;
}

// 배지 지표를 한 번만 계산해 획득 여부와 진행률에 함께 씁니다.
export function badgeMetricValues(
  activities: ActivityRecord[],
  streak: StreakSummary,
  context: BadgeContext = {},
): Record<BadgeMetric, number> {
  let morning = 0;
  let night = 0;
  for (const activity of activities) {
    const hour = hourInKst(activity.completedAt, activity.timezoneId || 'Asia/Seoul');
    if (hour >= 4 && hour < 9) morning += 1;
    if (hour >= 20 || (hour >= 0 && hour < 4)) night += 1;
  }
  return {
    coach_count: activities.filter((activity) => activity.source === 'COACH_COMPLETED').length,
    movement_streak: streak.best,
    weekly_run_weeks: streak.totalRunWeeks,
    run_count: activities.filter((activity) => activity.kind === 'run').length,
    run_distance: Math.max(0, ...activities.map((activity) => activity.distanceKm ?? 0)),
    ten_k_count: activities.filter((activity) => (activity.distanceKm ?? 0) >= 10).length,
    total_distance:
      Math.round(activities.reduce((total, activity) => total + (activity.distanceKm ?? 0), 0) * 100) /
      100,
    total_minutes: activities.reduce((total, activity) => total + activity.durationMinutes, 0),
    morning_run_count: morning,
    night_run_count: night,
    recovery_count: activities.filter((activity) => activity.kind === 'recovery').length,
    interval_count: activities.filter((activity) => activity.id.startsWith('coach:인터벌')).length,
    race_interest: Math.max(0, context.interestedRaceCount ?? 0),
    server_event: 0,
  };
}

export type BadgeProgress = {
  badge: BadgeDefinition;
  unlocked: boolean;
  value: number;
  target: number;
  ratio: number;
};

export function badgeProgressList(
  activities: ActivityRecord[],
  streak: StreakSummary,
  context: BadgeContext = {},
): BadgeProgress[] {
  const metrics = badgeMetricValues(activities, streak, context);
  return badgeDefinitions.map((badge) => {
    const value = badge.authority === 'server' ? 0 : metrics[badge.metric];
    const target = badge.threshold;
    return {
      badge,
      unlocked: badge.authority !== 'server' && value >= target,
      value,
      target,
      ratio: target > 0 ? Math.min(1, value / target) : 0,
    };
  });
}

export function unlockedBadges(
  activities: ActivityRecord[],
  streak: StreakSummary,
  context: BadgeContext = {},
): BadgeDefinition[] {
  return badgeProgressList(activities, streak, context)
    .filter((entry) => entry.unlocked)
    .map((entry) => entry.badge);
}

export const streakInternals = {
  dateKeyAtFourAm,
  startOfWeekKey,
};
