// 러닝봄의 04시 하루 경계, 연속 기록, 주간 달성, 누적 등급을 순수 함수로 계산합니다.
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
  // "스트릭" 대신 누구나 아는 말로 적습니다. id(streak-*)는 저장 호환을 위해 그대로 둡니다.
  streak: '연속 기록',
  consistency: '꾸준함',
  distance: '거리',
  duration: '시간',
  timeOfDay: '시간대',
  recovery: '회복',
  race: '대회',
  community: '함께',
};

/**
 * 배지 등급입니다. 동/은/금 대신 러닝봄의 봄(계절)에서 가져온 네 단계를 씁니다.
 * 등급은 화면에서 채도와 링 개수로만 드러나고, 획득 조건(threshold)과는 무관합니다.
 */
export type BadgeTier = 'seed' | 'sprout' | 'bud' | 'bloom';

export const badgeTierOrder: BadgeTier[] = ['seed', 'sprout', 'bud', 'bloom'];

export const badgeTierLabels: Record<BadgeTier, string> = {
  seed: '씨앗',
  sprout: '새싹',
  bud: '봉오리',
  bloom: '만개',
};

/** 등급을 처음 본 사람에게 한 줄로 설명합니다. */
export const badgeTierNotes: Record<BadgeTier, string> = {
  seed: '여기서 시작해요',
  sprout: '습관이 돋아나요',
  bud: '곧 피어나요',
  bloom: '활짝 피었어요',
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
  /** 받았을 때 기분이 좋은 이름입니다. 조건은 description에 적습니다. */
  title: string;
  description: string;
  threshold: number;
  metric: BadgeMetric;
  authority: 'local' | 'server';
  category: BadgeCategory;
  tier: BadgeTier;
};

/**
 * 임계값(threshold)별 이름·설명·등급 표입니다.
 * id는 `${prefix}-${threshold}` 규칙 그대로 만들어지므로, 이 표를 고쳐도
 * 이미 저장된 배지 id는 한 글자도 바뀌지 않습니다(AsyncStorage·SQLite 호환).
 */
type TieredEntry = readonly [threshold: number, title: string, description: string, tier: BadgeTier];

function tieredBadges<M extends BadgeMetric>(
  prefix: string,
  metric: M,
  category: BadgeCategory,
  entries: readonly TieredEntry[],
): BadgeDefinition[] {
  return entries.map(([threshold, title, description, tier]) => ({
    id: `${prefix}-${threshold}`,
    title,
    description,
    threshold,
    metric,
    authority: 'local' as const,
    category,
    tier,
  }));
}

export const badgeDefinitions: BadgeDefinition[] = [
  { id: 'first-coach', title: '첫 목소리', description: '코치와 함께 첫 세션을 마쳤어요.', threshold: 1, metric: 'coach_count', authority: 'local', category: 'first', tier: 'seed' },
  { id: 'first-run', title: '출발선 너머', description: '첫 러닝을 기록했어요.', threshold: 1, metric: 'run_count', authority: 'local', category: 'first', tier: 'seed' },
  { id: 'first-interval', title: '숨이 트인 날', description: '빠르게와 천천히를 번갈아 달리는 코칭을 한 번 마쳤어요.', threshold: 1, metric: 'interval_count', authority: 'local', category: 'first', tier: 'sprout' },
  { id: 'distance-3k', title: '동네 한 바퀴', description: '한 번에 3km를 달렸어요.', threshold: 3, metric: 'run_distance', authority: 'local', category: 'first', tier: 'seed' },
  { id: 'distance-5k', title: '더 멀리 간 날', description: '한 번에 5km를 달렸어요.', threshold: 5, metric: 'run_distance', authority: 'local', category: 'first', tier: 'sprout' },
  { id: 'distance-10k', title: '두 자리 수', description: '한 번에 10km를 달렸어요.', threshold: 10, metric: 'run_distance', authority: 'local', category: 'first', tier: 'bud' },
  { id: 'first-race-goal', title: '출사표', description: '첫 대회 목표를 공개했어요.', threshold: 1, metric: 'server_event', authority: 'server', category: 'race', tier: 'seed' },
  { id: 'first-crew', title: '같이 뛰는 사람들', description: '첫 크루 활동을 시작했어요.', threshold: 1, metric: 'server_event', authority: 'server', category: 'community', tier: 'seed' },
  { id: 'first-post', title: '기록을 나누다', description: '첫 활동글을 직접 올렸어요.', threshold: 1, metric: 'server_event', authority: 'server', category: 'community', tier: 'seed' },
  { id: 'first-cheer', title: '먼저 건넨 응원', description: '다른 러너를 처음으로 응원했어요.', threshold: 1, metric: 'server_event', authority: 'server', category: 'community', tier: 'seed' },
  ...tieredBadges('streak', 'movement_streak', 'streak', [
    [3, '사흘의 리듬', '3일 내리 몸을 움직였어요.', 'seed'],
    [7, '일주일의 결', '7일 내리 몸을 움직였어요.', 'sprout'],
    [14, '보름의 습관', '14일 내리 몸을 움직였어요.', 'sprout'],
    [30, '한 달을 잇다', '30일 내리 몸을 움직였어요.', 'bud'],
    [60, '두 달의 온기', '60일 내리 몸을 움직였어요.', 'bud'],
    [100, '백일의 약속', '100일 내리 몸을 움직였어요.', 'bloom'],
    [200, '이백 일의 뚝심', '200일 내리 몸을 움직였어요.', 'bloom'],
    [365, '사계절을 달리다', '365일 내리 몸을 움직였어요.', 'bloom'],
  ]),
  ...tieredBadges('weekly', 'weekly_run_weeks', 'consistency', [
    [1, '첫 한 주', '서로 다른 3일을 달린 주를 처음 만들었어요.', 'seed'],
    [4, '한 달치 성실', '서로 다른 3일을 달린 주를 4번 만들었어요.', 'sprout'],
    [12, '계절 하나', '서로 다른 3일을 달린 주를 12번 만들었어요.', 'bud'],
    [26, '반년의 무게', '서로 다른 3일을 달린 주를 26번 만들었어요.', 'bloom'],
    [52, '일 년의 증거', '서로 다른 3일을 달린 주를 52번 만들었어요.', 'bloom'],
  ]),
  ...tieredBadges('run', 'run_count', 'consistency', [
    [10, '열 번의 출발', '러닝을 10회 기록했어요.', 'sprout'],
    [50, '쉰 번째 신발끈', '러닝을 50회 기록했어요.', 'bud'],
    [100, '백 번 달린 사람', '러닝을 100회 기록했어요.', 'bloom'],
  ]),
  {
    id: 'ten-k-ten-times',
    title: '익숙해진 10km',
    description: '10km 이상 러닝을 10회 기록했어요.',
    threshold: 10,
    metric: 'ten_k_count',
    authority: 'local',
    category: 'distance',
    tier: 'bloom',
  },
  ...tieredBadges('total-distance', 'total_distance', 'distance', [
    [10, '쌓이기 시작', '달린 거리의 합이 10km를 넘었어요.', 'seed'],
    [50, '오십 고개', '달린 거리의 합이 50km를 넘었어요.', 'sprout'],
    [100, '세 자리 수', '달린 거리의 합이 100km를 넘었어요.', 'bud'],
    [250, '지도를 벗어나', '달린 거리의 합이 250km를 넘었어요.', 'bud'],
    [500, '오백의 발자국', '달린 거리의 합이 500km를 넘었어요.', 'bloom'],
    [1_000, '네 자리 수', '달린 거리의 합이 1,000km를 넘었어요.', 'bloom'],
  ]),
  ...tieredBadges('total-minutes', 'total_minutes', 'duration', [
    [300, '다섯 시간의 결', '활동 시간의 합이 5시간을 넘었어요.', 'seed'],
    [600, '열 시간의 무게', '활동 시간의 합이 10시간을 넘었어요.', 'sprout'],
    [1_800, '하루하고 여섯 시간', '활동 시간의 합이 30시간을 넘었어요.', 'bud'],
    [3_600, '이틀하고 반나절', '활동 시간의 합이 60시간을 넘었어요.', 'bloom'],
  ]),
  ...tieredBadges('morning-run', 'morning_run_count', 'timeOfDay', [
    [1, '새벽을 연 사람', '새벽 4시에서 아침 9시 사이에 한 번 마쳤어요.', 'seed'],
    [10, '아침을 아는 사람', '새벽 4시에서 아침 9시 사이에 10번 마쳤어요.', 'sprout'],
    [30, '서른 번의 아침', '새벽 4시에서 아침 9시 사이에 30번 마쳤어요.', 'bud'],
  ]),
  ...tieredBadges('night-run', 'night_run_count', 'timeOfDay', [
    [1, '가로등 아래', '저녁 8시에서 새벽 3시 사이에 한 번 마쳤어요.', 'seed'],
    [10, '밤이 편한 사람', '저녁 8시에서 새벽 3시 사이에 10번 마쳤어요.', 'sprout'],
    [30, '서른 번의 밤', '저녁 8시에서 새벽 3시 사이에 30번 마쳤어요.', 'bud'],
  ]),
  ...tieredBadges('recovery', 'recovery_count', 'recovery', [
    [1, '쉬는 것도 훈련', '회복 활동을 1회 기록했어요.', 'seed'],
    [5, '몸을 아끼는 법', '회복 활동을 5회 기록했어요.', 'sprout'],
    [20, '오래 달리는 법', '회복 활동을 20회 기록했어요.', 'bud'],
  ]),
  ...tieredBadges('race-interest', 'race_interest', 'race', [
    [1, '눈에 담은 대회', '참가를 살펴본 대회를 1개 저장했어요.', 'seed'],
    [5, '고르는 즐거움', '참가를 살펴본 대회를 5개 저장했어요.', 'sprout'],
  ]),
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
