// 배지를 화면에 보여 줄 때 쓰는 순수 규칙입니다.
// 문구·정렬·묶음만 다루고, 획득 판정은 rules.ts가 그대로 맡습니다.
import type { ActivityRecord } from '../activities/types';
import {
  badgeCategoryLabels,
  badgeCategoryOrder,
  badgeProgressList,
  calculateStreak,
  type BadgeCategory,
  type BadgeDefinition,
  type BadgeMetric,
  type BadgeProgress,
} from './rules';

/** 배지 하나가 지금 어떤 상태인지입니다. 화면은 이 세 가지만 그립니다. */
export type BadgeState = 'earned' | 'progress' | 'locked';

export type BadgeView = {
  badge: BadgeDefinition;
  state: BadgeState;
  ratio: number;
  /** "10km 중 6.4km"처럼 지금 얼마나 왔는지 한 줄로 적은 값입니다. */
  progressLabel: string;
  /** 아직 못 받은 배지에 붙는 "무엇을 하면 받는지" 한 줄입니다. */
  hintLabel: string;
  /** 획득 날짜를 알 수 있으면 "2026년 7월 26일" 형태로 채웁니다. */
  earnedLabel?: string;
};

/** 진행률이 이 값을 넘으면 "잠김"이 아니라 "진행 중"으로 봅니다. */
export const progressThreshold = 0.02;

function trimNumber(value: number, digits = 0): string {
  const factor = 10 ** digits;
  const rounded = Math.round(value * factor) / factor;
  return rounded.toLocaleString('ko-KR', { maximumFractionDigits: digits });
}

/** 지표마다 단위가 달라서, 숫자 하나를 사람이 읽는 말로 바꿉니다. */
export function formatMetricValue(metric: BadgeMetric, value: number): string {
  switch (metric) {
    case 'run_distance':
    case 'total_distance':
      return `${trimNumber(value, 1)}km`;
    case 'total_minutes': {
      if (value < 60) return `${trimNumber(value)}분`;
      const hours = value / 60;
      return `${trimNumber(hours, hours < 10 ? 1 : 0)}시간`;
    }
    case 'movement_streak':
      return `${trimNumber(value)}일`;
    case 'weekly_run_weeks':
      return `${trimNumber(value)}주`;
    case 'race_interest':
      return `${trimNumber(value)}개`;
    default:
      return `${trimNumber(value)}회`;
  }
}

/** "10km 중 6.4km"처럼 목표 대비 현재값을 적습니다. */
export function progressLabelFor(entry: BadgeProgress): string {
  if (entry.badge.authority === 'server') return '서버와 연결하면 확인할 수 있어요';
  const target = formatMetricValue(entry.badge.metric, entry.target);
  if (entry.unlocked) return `${target} 달성`;
  const value = formatMetricValue(entry.badge.metric, entry.value);
  return `${target} 중 ${value}`;
}

/** 아직 못 받은 배지에 "무엇을 하면 받는지"를 한 줄로 적습니다. */
export function hintLabelFor(entry: BadgeProgress): string {
  if (entry.badge.authority === 'server') return '서버와 연결하면 열려요';
  const remaining = Math.max(0, entry.target - entry.value);
  if (remaining <= 0) return '조건을 채웠어요';
  return `${formatMetricValue(entry.badge.metric, remaining)} 더 하면 받아요`;
}

export function badgeStateFor(entry: BadgeProgress): BadgeState {
  if (entry.unlocked) return 'earned';
  return entry.ratio >= progressThreshold ? 'progress' : 'locked';
}

const dateFormatter = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'Asia/Seoul',
});

export function formatEarnedDate(value?: string): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return undefined;
  return dateFormatter.format(parsed);
}

export function toBadgeView(entry: BadgeProgress, earnedAt?: string): BadgeView {
  return {
    badge: entry.badge,
    state: badgeStateFor(entry),
    ratio: entry.ratio,
    progressLabel: progressLabelFor(entry),
    hintLabel: hintLabelFor(entry),
    earnedLabel: formatEarnedDate(earnedAt),
  };
}

/** 받은 것 → 진행 중 → 잠긴 것 순서입니다. 같은 상태끼리는 진행률이 높은 쪽을 앞에 둡니다. */
const stateRank: Record<BadgeState, number> = { earned: 0, progress: 1, locked: 2 };

export function sortBadgeViews(views: BadgeView[]): BadgeView[] {
  return [...views].sort((left, right) => {
    const byState = stateRank[left.state] - stateRank[right.state];
    if (byState !== 0) return byState;
    if (left.state === 'earned') return left.badge.threshold - right.badge.threshold;
    return right.ratio - left.ratio;
  });
}

export type BadgeSection = {
  category: BadgeCategory;
  label: string;
  earned: number;
  total: number;
  views: BadgeView[];
};

export function badgeSections(views: BadgeView[]): BadgeSection[] {
  return badgeCategoryOrder
    .map((category) => {
      const inCategory = views.filter((view) => view.badge.category === category);
      return {
        category,
        label: badgeCategoryLabels[category],
        earned: inCategory.filter((view) => view.state === 'earned').length,
        total: inCategory.length,
        views: sortBadgeViews(inCategory),
      };
    })
    .filter((section) => section.total > 0);
}

/**
 * 아직 하나도 못 받았을 때 "첫 배지까지 이만큼 남았어요"에 쓸 가장 가까운 배지입니다.
 * 서버 배지는 혼자 힘으로 당길 수 없으니 제외합니다.
 */
export function nearestBadge(views: BadgeView[]): BadgeView | undefined {
  return views
    .filter((view) => view.state !== 'earned' && view.badge.authority === 'local')
    .sort((left, right) => right.ratio - left.ratio)
    .at(0);
}

/** 상단에 크게 걸어 줄 "가장 최근에 받은 배지"입니다. 날짜를 모르면 가장 어려운 배지를 씁니다. */
export function highlightBadge(views: BadgeView[], featuredId?: string): BadgeView | undefined {
  const earned = views.filter((view) => view.state === 'earned');
  if (earned.length === 0) return undefined;
  const featured = featuredId ? earned.find((view) => view.badge.id === featuredId) : undefined;
  if (featured) return featured;
  return [...earned].sort((left, right) => right.badge.threshold - left.badge.threshold).at(0);
}

export type BadgeTally = {
  earned: number;
  total: number;
  ratio: number;
};

export function badgeTally(views: BadgeView[]): BadgeTally {
  const earned = views.filter((view) => view.state === 'earned').length;
  const total = views.length;
  return { earned, total, ratio: total > 0 ? earned / total : 0 };
}

/**
 * 이전에 본 배지 목록과 견주어 새로 받은 배지를 찾습니다.
 * 화면은 이 결과가 있을 때만 축하 카드를 띄웁니다.
 */
export function newlyEarnedBadges(previousIds: string[], views: BadgeView[]): BadgeView[] {
  const seen = new Set(previousIds);
  return views.filter((view) => view.state === 'earned' && !seen.has(view.badge.id));
}

/** 되짚기 계산을 건너뛰는 기록 개수입니다. 이보다 많으면 받은 날짜를 비워 둡니다. */
export const earnedDateReplayLimit = 2_000;

/**
 * 기록을 시간순으로 되짚어 배지를 "언제 처음 받았는지" 찾습니다.
 * 모든 지표가 시간이 갈수록 줄지 않으므로 이분 탐색이 성립합니다.
 * 서버 배지와 대회 관심 배지는 활동 기록만으로 시점을 알 수 없어 제외합니다.
 */
export function earnedDates(activities: ActivityRecord[]): Record<string, string> {
  if (activities.length === 0 || activities.length > earnedDateReplayLimit) return {};
  const sorted = [...activities].sort(
    (left, right) => Date.parse(left.completedAt) - Date.parse(right.completedAt),
  );
  const cache = new Map<number, Set<string>>();
  const unlockedAt = (count: number): Set<string> => {
    const cached = cache.get(count);
    if (cached) return cached;
    const slice = sorted.slice(0, count);
    const last = slice.at(-1);
    const streak = calculateStreak(slice, last ? new Date(last.completedAt) : new Date());
    const ids = new Set(
      badgeProgressList(slice, streak)
        .filter((entry) => entry.unlocked && entry.badge.metric !== 'race_interest')
        .map((entry) => entry.badge.id),
    );
    cache.set(count, ids);
    return ids;
  };

  const result: Record<string, string> = {};
  for (const id of unlockedAt(sorted.length)) {
    let low = 1;
    let high = sorted.length;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (unlockedAt(mid).has(id)) high = mid;
      else low = mid + 1;
    }
    const moment = sorted[low - 1];
    if (moment) result[id] = moment.completedAt;
  }
  return result;
}

/** 받은 날짜를 아는 배지 중 가장 최근 것을 고릅니다. */
export function mostRecentEarned(
  views: BadgeView[],
  dates: Record<string, string>,
): BadgeView | undefined {
  const dated = views
    .filter((view) => view.state === 'earned' && dates[view.badge.id])
    .sort((left, right) => {
      const byDate = Date.parse(dates[right.badge.id]) - Date.parse(dates[left.badge.id]);
      if (byDate !== 0) return byDate;
      // 같은 활동에서 여러 개가 한꺼번에 열렸으면 더 어려운 쪽을 대표로 세웁니다.
      return right.badge.threshold - left.badge.threshold;
    });
  return dated.at(0) ?? highlightBadge(views);
}
