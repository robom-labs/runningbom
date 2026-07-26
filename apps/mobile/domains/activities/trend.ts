// 기록·통계의 월별 추이, 활동 목록 필터, 평균 페이스를 계산하는 순수 규칙입니다.
// 외부 차트 라이브러리를 쓰지 않으므로 막대 높이 비율까지 여기서 계산합니다.
import {
  addDaysKey,
  currentMonth,
  kstDayKey,
  monthKey,
  totalsForMonth,
  type PeriodTotals,
} from './summary';
import type { ActivityKind, ActivityRecord } from './types';

export type TrendMetric = 'sessions' | 'minutes' | 'distance';

export const trendMetricLabels: Record<TrendMetric, string> = {
  sessions: '횟수',
  minutes: '시간',
  distance: '거리',
};

export type TrendPoint = {
  month: string;
  /** '7월'처럼 짧게 쓰는 축 라벨입니다. */
  label: string;
  totals: PeriodTotals;
  value: number;
  /** 0~1 사이의 막대 높이 비율입니다. 최댓값이 0이면 모두 0입니다. */
  ratio: number;
  isCurrent: boolean;
};

function shiftMonth(month: string, delta: number): string {
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7)) - 1;
  const date = new Date(Date.UTC(year, monthIndex + delta, 1));
  return date.toISOString().slice(0, 7);
}

export function trendValue(metric: TrendMetric, totals: PeriodTotals): number {
  if (metric === 'sessions') return totals.sessions;
  if (metric === 'minutes') return totals.minutes;
  return totals.distanceKm;
}

/** 이번 달을 포함한 최근 N개월의 추이입니다. 기록이 없는 달도 0으로 자리를 지킵니다. */
export function monthlyTrend(
  activities: ActivityRecord[],
  metric: TrendMetric,
  months = 6,
  now: Date | number = Date.now(),
): TrendPoint[] {
  const thisMonth = currentMonth(now);
  const span = Math.max(1, Math.min(24, Math.round(months)));
  const entries = Array.from({ length: span }, (_, index) => {
    const month = shiftMonth(thisMonth, index - (span - 1));
    const totals = totalsForMonth(activities, month);
    return {
      month,
      label: `${Number(month.slice(5, 7))}월`,
      totals,
      value: trendValue(metric, totals),
      isCurrent: month === thisMonth,
    };
  });
  const max = Math.max(...entries.map((entry) => entry.value), 0);
  return entries.map((entry) => ({
    ...entry,
    ratio: max > 0 ? entry.value / max : 0,
  }));
}

// ── 활동 목록 필터 ────────────────────────────────────────────────────────

export const activityKindFilters = ['전체', 'run', 'walk', 'recovery'] as const;
export type ActivityKindFilter = (typeof activityKindFilters)[number];

export const activityKindFilterLabels: Record<ActivityKindFilter, string> = {
  전체: '전체',
  run: '러닝',
  walk: '걷기',
  recovery: '회복',
};

export const activityPeriodFilters = ['전체', '최근 7일', '최근 30일', '이번 달'] as const;
export type ActivityPeriodFilter = (typeof activityPeriodFilters)[number];

export type ActivityListFilter = {
  kind: ActivityKindFilter;
  period: ActivityPeriodFilter;
};

export const defaultActivityListFilter: ActivityListFilter = { kind: '전체', period: '전체' };

export function filterActivities(
  activities: ActivityRecord[],
  filter: ActivityListFilter,
  now: Date | number = Date.now(),
): ActivityRecord[] {
  const today = kstDayKey(new Date(now));
  const thisMonth = monthKey(today);
  return activities.filter((activity) => {
    if (filter.kind !== '전체' && activity.kind !== (filter.kind as ActivityKind)) return false;
    const day = kstDayKey(activity.completedAt);
    if (!day) return filter.period === '전체';
    if (filter.period === '최근 7일') return day >= addDaysKey(today, -6) && day <= today;
    if (filter.period === '최근 30일') return day >= addDaysKey(today, -29) && day <= today;
    if (filter.period === '이번 달') return monthKey(day) === thisMonth;
    return true;
  });
}

// ── 평균 페이스 ──────────────────────────────────────────────────────────

/** 거리와 시간이 모두 있는 기록만으로 평균 페이스를 계산합니다. 없으면 undefined입니다. */
export function averagePaceMinutesPerKm(activities: ActivityRecord[]): number | undefined {
  let minutes = 0;
  let distanceKm = 0;
  for (const activity of activities) {
    const distance = activity.distanceKm ?? 0;
    if (distance <= 0 || activity.durationMinutes <= 0) continue;
    minutes += activity.durationMinutes;
    distanceKm += distance;
  }
  if (distanceKm <= 0) return undefined;
  return minutes / distanceKm;
}

export function formatPace(minutesPerKm: number | undefined): string {
  if (minutesPerKm === undefined || !Number.isFinite(minutesPerKm) || minutesPerKm <= 0) {
    return '기록 부족';
  }
  const totalSeconds = Math.round(minutesPerKm * 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}'${String(seconds).padStart(2, '0')}"/km`;
}

// ── 오늘의 추천 ──────────────────────────────────────────────────────────

export type TodaySuggestionTone = 'rest' | 'easy' | 'steady' | 'quality';

export type TodaySuggestion = {
  tone: TodaySuggestionTone;
  title: string;
  body: string;
  minutes: number;
};

const weekdayNames = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 요일과 최근 부하만 보고 무리하지 않는 오늘의 러닝을 제안합니다.
 * 의학적 판단이 아니라 "무리하지 않는 기본값"이며, 확실할 때만 강도를 올립니다.
 */
export function suggestTodayRun(
  activities: ActivityRecord[],
  fallbackMinutes: number,
  now: Date | number = Date.now(),
): TodaySuggestion {
  const today = kstDayKey(new Date(now));
  const baseMinutes = Math.max(10, Math.min(120, Math.round(fallbackMinutes)));
  const dayOfWeek = new Date(`${today}T00:00:00Z`).getUTCDay();
  const weekday = weekdayNames[dayOfWeek] ?? '';

  const last7 = activities.filter((activity) => {
    const day = kstDayKey(activity.completedAt);
    return Boolean(day) && day >= addDaysKey(today, -6) && day <= today;
  });
  const ranToday = activities.some((activity) => kstDayKey(activity.completedAt) === today);
  const ranYesterday = activities.some(
    (activity) => kstDayKey(activity.completedAt) === addDaysKey(today, -1),
  );
  const daysInLast7 = new Set(
    last7.map((activity) => kstDayKey(activity.completedAt)).filter(Boolean),
  ).size;

  if (ranToday) {
    return {
      tone: 'rest',
      title: '오늘은 이미 기록이 있어요',
      body: '한 번 더 달릴 계획이 아니라면 가볍게 마무리해도 좋아요.',
      minutes: baseMinutes,
    };
  }
  if (daysInLast7 >= 5) {
    return {
      tone: 'rest',
      title: '오늘은 쉬어도 좋은 날',
      body: `최근 7일 중 ${daysInLast7}일을 움직였어요. 쉬거나 가볍게 걷는 것도 계획의 일부예요.`,
      minutes: Math.max(15, Math.round(baseMinutes * 0.5)),
    };
  }
  if (ranYesterday) {
    return {
      tone: 'easy',
      title: '오늘은 편한 러닝',
      body: '어제 달렸으니 대화가 가능한 속도로 짧게 다녀오는 구성이 무리가 적어요.',
      minutes: Math.max(15, Math.round(baseMinutes * 0.7)),
    };
  }
  if (daysInLast7 === 0) {
    return {
      tone: 'easy',
      title: '가볍게 다시 시작하기',
      body: '최근 7일 기록이 없어요. 짧게 걷기와 달리기를 섞어 감을 되찾는 걸 추천해요.',
      minutes: Math.max(15, Math.round(baseMinutes * 0.6)),
    };
  }
  if ((dayOfWeek === 6 || dayOfWeek === 0) && daysInLast7 >= 2) {
    return {
      tone: 'steady',
      title: `${weekday}요일 · 조금 길게`,
      body: '주말은 시간을 조금 더 낼 수 있는 날이에요. 평소보다 길게, 속도는 편하게 가 보세요.',
      minutes: Math.min(120, Math.round(baseMinutes * 1.2)),
    };
  }
  if (daysInLast7 >= 3) {
    return {
      tone: 'quality',
      title: '리듬이 잡혔어요',
      body: '이번 주 흐름이 좋아요. 강약을 나누고 싶다면 짧은 빠른 구간을 한 번만 섞어 보세요.',
      minutes: baseMinutes,
    };
  }
  return {
    tone: 'steady',
    title: `${weekday}요일 · 기본 러닝`,
    body: '평소 리듬대로 편하게 달리는 날이에요.',
    minutes: baseMinutes,
  };
}
