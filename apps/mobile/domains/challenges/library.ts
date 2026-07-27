// 도전입니다. "이번 달에 이만큼 해보자" 같은 목표를 스스로 세우는 층입니다.
//
// 이 층이 절대 하지 않는 일:
//   **훈련량을 늘리라고 시키지 않습니다.**
//   도전은 이미 남긴 기록을 해석해서 보여 줄 뿐이고, 계획이나 훈련을 바꾸지 않습니다.
//   "30일 연속 달리기" 같은 것을 넣지 않은 이유도 같습니다. 그건 사람을 다치게 합니다.
//   쉬는 날을 허용하지 않는 도전은 이 파일에 넣지 않습니다.
//
// 계산은 전부 순수 함수입니다. 활동 기록을 넣으면 진행률이 나옵니다.
// 서버도, 새 저장소도 필요 없습니다.
import type { ActivityRecord } from '../activities/types';

/** 무엇을 세는지입니다. */
export type ChallengeMetric =
  /** 활동 횟수 */
  | 'sessions'
  /** 움직인 시간(분) */
  | 'minutes'
  /** 거리(km) — 거리가 없는 기록은 세지 않습니다. */
  | 'distanceKm'
  /** 활동한 날의 수(하루에 여러 번 해도 하루로 셉니다) */
  | 'days';

/** 언제부터 언제까지 세는지입니다. */
export type ChallengeWindow = 'week' | 'month' | 'rolling30' | 'allTime';

export type ChallengeCategory = 'HABIT' | 'VOLUME' | 'DISTANCE' | 'VARIETY' | 'MILESTONE';

export const challengeCategoryLabels: Record<ChallengeCategory, string> = {
  HABIT: '꾸준히',
  VOLUME: '쌓기',
  DISTANCE: '거리',
  VARIETY: '골고루',
  MILESTONE: '한 번은',
};

export const challengeWindowLabels: Record<ChallengeWindow, string> = {
  week: '이번 주',
  month: '이번 달',
  rolling30: '최근 30일',
  allTime: '전체 기간',
};

export type Challenge = {
  /** 저장에 쓰는 고유 ID입니다. 한 번 정하면 바꾸지 않습니다. */
  id: string;
  title: string;
  description: string;
  category: ChallengeCategory;
  metric: ChallengeMetric;
  window: ChallengeWindow;
  /** 이 값에 도달하면 달성입니다. */
  target: number;
  /** 걷기만 해도 세는지입니다. false면 뛴 기록만 셉니다. */
  countsWalking: boolean;
};

/** 기록 하나가 이 도전에 해당하는지입니다. */
function counts(challenge: Challenge, record: ActivityRecord): boolean {
  if (challenge.countsWalking) return true;
  return record.kind === 'run';
}

/** 같은 날인지 지역 시간 기준으로 봅니다. */
function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function startOfWeek(now: Date): Date {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  // 월요일 시작입니다. 일요일(0)은 6일 전으로 돌립니다.
  const weekday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - weekday);
  return date;
}

function startOfMonth(now: Date): Date {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  date.setDate(1);
  return date;
}

/** 이 도전이 세는 기간의 시작 시각입니다. */
export function windowStart(window: ChallengeWindow, now: Date): Date | undefined {
  if (window === 'allTime') return undefined;
  if (window === 'week') return startOfWeek(now);
  if (window === 'month') return startOfMonth(now);
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - 29);
  return date;
}

export type ChallengeProgress = {
  challenge: Challenge;
  /** 지금까지 채운 값입니다. */
  current: number;
  /** 0~1입니다. 1을 넘지 않습니다. */
  ratio: number;
  achieved: boolean;
  /** 화면에 그대로 쓰는 말입니다. 예: "3 / 5회" */
  label: string;
  /** 남은 것을 사람 말로 알려 줍니다. 달성했으면 축하하는 말입니다. */
  note: string;
};

function unitOf(metric: ChallengeMetric): string {
  if (metric === 'sessions') return '회';
  if (metric === 'minutes') return '분';
  if (metric === 'distanceKm') return 'km';
  return '일';
}

/** 숫자를 보기 좋게 다듬습니다. 거리만 소수 첫째 자리를 남깁니다. */
function tidy(value: number, metric: ChallengeMetric): number {
  if (metric === 'distanceKm') return Math.round(value * 10) / 10;
  return Math.round(value);
}

/**
 * 도전 하나의 진행 상황을 계산합니다.
 * 같은 기록을 넣으면 언제나 같은 결과가 나옵니다(결정적).
 */
export function challengeProgress(
  challenge: Challenge,
  activities: ActivityRecord[],
  now: Date,
): ChallengeProgress {
  const start = windowStart(challenge.window, now);
  const inWindow = activities.filter((record) => {
    if (!counts(challenge, record)) return false;
    if (!start) return true;
    const at = new Date(record.completedAt);
    return Number.isFinite(at.getTime()) && at >= start && at <= now;
  });

  let current = 0;
  if (challenge.metric === 'sessions') current = inWindow.length;
  else if (challenge.metric === 'minutes') {
    current = inWindow.reduce((sum, record) => sum + Math.max(0, record.durationMinutes), 0);
  } else if (challenge.metric === 'distanceKm') {
    current = inWindow.reduce((sum, record) => sum + Math.max(0, record.distanceKm ?? 0), 0);
  } else {
    current = new Set(inWindow.map((record) => dayKey(record.completedAt))).size;
  }

  const shown = tidy(current, challenge.metric);
  const ratio = challenge.target <= 0 ? 0 : Math.min(1, current / challenge.target);
  const achieved = current >= challenge.target;
  const unit = unitOf(challenge.metric);
  const remaining = tidy(Math.max(0, challenge.target - current), challenge.metric);

  return {
    challenge,
    current: shown,
    ratio,
    achieved,
    label: `${shown} / ${challenge.target}${unit}`,
    note: achieved
      ? '해냈어요. 이건 그냥 지나가지 말고 한 번 알아주고 가요.'
      : `${remaining}${unit} 남았어요.`,
  };
}

/**
 * 도전 목록입니다.
 *
 * 규칙:
 *  - 쉬는 날을 못 쉬게 하는 도전은 넣지 않습니다(연속 30일 같은 것).
 *  - 처음 쓰는 사람도 하나는 바로 달성할 수 있게 낮은 목표를 둡니다.
 *  - 걷기만 해도 세는 도전을 충분히 둡니다. 달리기만 인정하면 걷는 사람이 떠납니다.
 */
export const challenges: Challenge[] = [
  // 꾸준히 — 가장 중요한 습관 층입니다. 목표를 낮게 잡습니다.
  {
    id: 'week-move-2',
    title: '이번 주 두 번 움직이기',
    description: '걷기도 셉니다. 두 번이면 충분해요.',
    category: 'HABIT',
    metric: 'sessions',
    window: 'week',
    target: 2,
    countsWalking: true,
  },
  {
    id: 'week-move-3',
    title: '이번 주 세 번 움직이기',
    description: '가장 많은 사람이 성공하는 목표예요.',
    category: 'HABIT',
    metric: 'sessions',
    window: 'week',
    target: 3,
    countsWalking: true,
  },
  {
    id: 'week-move-4',
    title: '이번 주 네 번 움직이기',
    description: '이미 리듬이 잡힌 분에게 맞아요.',
    category: 'HABIT',
    metric: 'sessions',
    window: 'week',
    target: 4,
    countsWalking: true,
  },
  {
    id: 'week-run-2',
    title: '이번 주 두 번 달리기',
    description: '걷기는 빼고 뛴 것만 셉니다.',
    category: 'HABIT',
    metric: 'sessions',
    window: 'week',
    target: 2,
    countsWalking: false,
  },
  {
    id: 'week-run-3',
    title: '이번 주 세 번 달리기',
    description: '주 3회는 몸이 기억하기 시작하는 횟수예요.',
    category: 'HABIT',
    metric: 'sessions',
    window: 'week',
    target: 3,
    countsWalking: false,
  },
  {
    id: 'month-days-8',
    title: '이번 달 여드레 움직이기',
    description: '하루에 여러 번 해도 하루로 세요. 날짜를 채우는 도전이에요.',
    category: 'HABIT',
    metric: 'days',
    window: 'month',
    target: 8,
    countsWalking: true,
  },
  {
    id: 'month-days-12',
    title: '이번 달 열이틀 움직이기',
    description: '이틀에 한 번꼴이에요. 쉬는 날도 넉넉해요.',
    category: 'HABIT',
    metric: 'days',
    window: 'month',
    target: 12,
    countsWalking: true,
  },
  {
    id: 'month-days-16',
    title: '이번 달 열엿새 움직이기',
    description: '이틀에 한 번보다 조금 더예요.',
    category: 'HABIT',
    metric: 'days',
    window: 'month',
    target: 16,
    countsWalking: true,
  },
  {
    id: 'rolling30-days-10',
    title: '최근 30일에 열흘',
    description: '달이 바뀌어도 끊기지 않아요. 오늘 기준 30일을 봅니다.',
    category: 'HABIT',
    metric: 'days',
    window: 'rolling30',
    target: 10,
    countsWalking: true,
  },
  {
    id: 'rolling30-days-15',
    title: '최근 30일에 보름',
    description: '이틀에 한 번 나가면 채워져요.',
    category: 'HABIT',
    metric: 'days',
    window: 'rolling30',
    target: 15,
    countsWalking: true,
  },

  // 쌓기 — 시간으로 세는 도전입니다. 속도가 느려도 불리하지 않습니다.
  {
    id: 'week-minutes-60',
    title: '이번 주 60분 채우기',
    description: '한 번에 몰아서 해도 되고 나눠서 해도 돼요.',
    category: 'VOLUME',
    metric: 'minutes',
    window: 'week',
    target: 60,
    countsWalking: true,
  },
  {
    id: 'week-minutes-90',
    title: '이번 주 90분 채우기',
    description: '30분씩 세 번이면 채워져요.',
    category: 'VOLUME',
    metric: 'minutes',
    window: 'week',
    target: 90,
    countsWalking: true,
  },
  {
    id: 'week-minutes-120',
    title: '이번 주 두 시간 채우기',
    description: '걷기도 함께 셉니다.',
    category: 'VOLUME',
    metric: 'minutes',
    window: 'week',
    target: 120,
    countsWalking: true,
  },
  {
    id: 'week-minutes-150',
    title: '이번 주 150분 채우기',
    description: '세계보건기구가 권하는 주간 활동 시간과 같은 값이에요.',
    category: 'VOLUME',
    metric: 'minutes',
    window: 'week',
    target: 150,
    countsWalking: true,
  },
  {
    id: 'month-minutes-300',
    title: '이번 달 다섯 시간',
    description: '한 주에 한 시간 조금 넘게 하면 채워져요.',
    category: 'VOLUME',
    metric: 'minutes',
    window: 'month',
    target: 300,
    countsWalking: true,
  },
  {
    id: 'month-minutes-500',
    title: '이번 달 여덟 시간',
    description: '꾸준히 하는 분에게 맞는 목표예요.',
    category: 'VOLUME',
    metric: 'minutes',
    window: 'month',
    target: 500,
    countsWalking: true,
  },
  {
    id: 'month-minutes-720',
    title: '이번 달 열두 시간',
    description: '하루 평균 24분이에요. 생각보다 할 만해요.',
    category: 'VOLUME',
    metric: 'minutes',
    window: 'month',
    target: 720,
    countsWalking: true,
  },
  {
    id: 'month-run-minutes-240',
    title: '이번 달 네 시간 달리기',
    description: '뛴 시간만 셉니다. 걷기는 빠져요.',
    category: 'VOLUME',
    metric: 'minutes',
    window: 'month',
    target: 240,
    countsWalking: false,
  },
  {
    id: 'rolling30-minutes-400',
    title: '최근 30일 여섯 시간 반',
    description: '달력과 상관없이 오늘 기준으로 봅니다.',
    category: 'VOLUME',
    metric: 'minutes',
    window: 'rolling30',
    target: 400,
    countsWalking: true,
  },

  // 거리 — 거리를 재는 기록이 있어야 셉니다.
  {
    id: 'week-km-5',
    title: '이번 주 5km',
    description: '거리가 기록된 활동만 셉니다.',
    category: 'DISTANCE',
    metric: 'distanceKm',
    window: 'week',
    target: 5,
    countsWalking: true,
  },
  {
    id: 'week-km-10',
    title: '이번 주 10km',
    description: '한 번에 다 갈 필요 없어요. 나눠서 채워요.',
    category: 'DISTANCE',
    metric: 'distanceKm',
    window: 'week',
    target: 10,
    countsWalking: true,
  },
  {
    id: 'week-km-20',
    title: '이번 주 20km',
    description: '주 3회 달리는 분에게 맞는 양이에요.',
    category: 'DISTANCE',
    metric: 'distanceKm',
    window: 'week',
    target: 20,
    countsWalking: true,
  },
  {
    id: 'month-km-30',
    title: '이번 달 30km',
    description: '한 주에 7km 조금 넘게 하면 채워져요.',
    category: 'DISTANCE',
    metric: 'distanceKm',
    window: 'month',
    target: 30,
    countsWalking: true,
  },
  {
    id: 'month-km-50',
    title: '이번 달 50km',
    description: '꾸준히 달리는 분의 한 달 양이에요.',
    category: 'DISTANCE',
    metric: 'distanceKm',
    window: 'month',
    target: 50,
    countsWalking: true,
  },
  {
    id: 'month-km-100',
    title: '이번 달 100km',
    description: '한 주에 25km예요. 무리하지 말고 되는 달에만 하세요.',
    category: 'DISTANCE',
    metric: 'distanceKm',
    window: 'month',
    target: 100,
    countsWalking: true,
  },
  {
    id: 'month-run-km-40',
    title: '이번 달 달려서 40km',
    description: '걷기는 빼고 뛴 거리만 셉니다.',
    category: 'DISTANCE',
    metric: 'distanceKm',
    window: 'month',
    target: 40,
    countsWalking: false,
  },
  {
    id: 'rolling30-km-42',
    title: '최근 30일에 마라톤 거리',
    description: '한 번에 42km를 뛰는 게 아니라, 30일 동안 다 더해서 42km예요.',
    category: 'DISTANCE',
    metric: 'distanceKm',
    window: 'rolling30',
    target: 42,
    countsWalking: true,
  },

  // 골고루 — 한 가지만 하지 않게 합니다.
  {
    id: 'week-walk-2',
    title: '이번 주 걷기 두 번',
    description: '달리기만 하지 않는 것도 훈련이에요.',
    category: 'VARIETY',
    metric: 'sessions',
    window: 'week',
    target: 2,
    countsWalking: true,
  },
  {
    id: 'month-sessions-10',
    title: '이번 달 열 번 나가기',
    description: '걷기·달리기 무엇이든 셉니다.',
    category: 'VARIETY',
    metric: 'sessions',
    window: 'month',
    target: 10,
    countsWalking: true,
  },
  {
    id: 'month-sessions-20',
    title: '이번 달 스무 번 나가기',
    description: '짧아도 좋으니 자주 나가는 달이에요.',
    category: 'VARIETY',
    metric: 'sessions',
    window: 'month',
    target: 20,
    countsWalking: true,
  },

  // 한 번은 — 전체 기간을 봅니다. 처음 쓰는 사람에게 첫 성취를 줍니다.
  {
    id: 'all-first-move',
    title: '첫 기록 남기기',
    description: '걷기 한 번이면 됩니다. 여기서부터 시작이에요.',
    category: 'MILESTONE',
    metric: 'sessions',
    window: 'allTime',
    target: 1,
    countsWalking: true,
  },
  {
    id: 'all-first-run',
    title: '첫 달리기',
    description: '단 1분이라도 뛴 기록이 있으면 달성이에요.',
    category: 'MILESTONE',
    metric: 'sessions',
    window: 'allTime',
    target: 1,
    countsWalking: false,
  },
  {
    id: 'all-sessions-10',
    title: '열 번 나가기',
    description: '열 번이면 습관의 시작이에요.',
    category: 'MILESTONE',
    metric: 'sessions',
    window: 'allTime',
    target: 10,
    countsWalking: true,
  },
  {
    id: 'all-sessions-50',
    title: '쉰 번 나가기',
    description: '여기까지 오면 달리기가 생활이 돼 있어요.',
    category: 'MILESTONE',
    metric: 'sessions',
    window: 'allTime',
    target: 50,
    countsWalking: true,
  },
  {
    id: 'all-sessions-100',
    title: '백 번 나가기',
    description: '백 번. 말이 백 번이지 대단한 일이에요.',
    category: 'MILESTONE',
    metric: 'sessions',
    window: 'allTime',
    target: 100,
    countsWalking: true,
  },
  {
    id: 'all-km-100',
    title: '누적 100km',
    description: '지금까지 움직인 거리를 다 더한 값이에요.',
    category: 'MILESTONE',
    metric: 'distanceKm',
    window: 'allTime',
    target: 100,
    countsWalking: true,
  },
  {
    id: 'all-km-500',
    title: '누적 500km',
    description: '서울에서 부산을 왕복하고도 남는 거리예요.',
    category: 'MILESTONE',
    metric: 'distanceKm',
    window: 'allTime',
    target: 500,
    countsWalking: true,
  },
  {
    id: 'all-km-1000',
    title: '누적 1000km',
    description: '천 킬로미터. 몇 년이 걸려도 좋은 목표예요.',
    category: 'MILESTONE',
    metric: 'distanceKm',
    window: 'allTime',
    target: 1000,
    countsWalking: true,
  },
  {
    id: 'all-minutes-1000',
    title: '누적 1000분',
    description: '지금까지 움직인 시간을 다 더한 값이에요.',
    category: 'MILESTONE',
    metric: 'minutes',
    window: 'allTime',
    target: 1000,
    countsWalking: true,
  },
  {
    id: 'all-days-30',
    title: '서른 날 움직인 사람',
    description: '연속이 아니어도 됩니다. 서른 날이면 충분해요.',
    category: 'MILESTONE',
    metric: 'days',
    window: 'allTime',
    target: 30,
    countsWalking: true,
  },
];

/** 목록이 규칙을 지키는지 봅니다. 빈 배열이면 통과입니다. */
export function validateChallenges(): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const challenge of challenges) {
    if (seen.has(challenge.id)) problems.push(`도전 ID가 겹칩니다: ${challenge.id}`);
    seen.add(challenge.id);
    if (challenge.target <= 0) problems.push(`${challenge.id}: 목표가 ${challenge.target}입니다.`);
    if (!challenge.title) problems.push(`${challenge.id}: 제목이 없습니다.`);
    if (!challenge.description) problems.push(`${challenge.id}: 설명이 없습니다.`);
    // 쉬는 날을 못 쉬게 하는 도전은 넣지 않기로 했습니다.
    //
    // 구조적으로는 이미 불가능합니다. 세는 방법에 "연속"이라는 것이 아예 없고,
    // days는 서로 떨어진 날짜도 그대로 셉니다.
    // 다만 제목이 연속처럼 읽히면 사용자가 쉬면 안 된다고 오해하므로 제목만 봅니다.
    // (설명에서 "연속이 아니어도 됩니다"라고 알려 주는 것은 오히려 필요합니다.)
    if (/연속/.test(challenge.title)) {
      problems.push(`${challenge.id}: 제목이 연속 달성을 요구하는 것처럼 읽힙니다.`);
    }
  }
  return problems;
}

/**
 * 지금 보여 줄 도전을 고릅니다.
 *
 * 다 보여 주면 서른 개가 넘어 화면이 숫자밭이 됩니다.
 * 아직 못 이룬 것 중 가장 가까운 것부터, 그리고 방금 이룬 것 몇 개를 보여 줍니다.
 */
export function activeChallenges(
  activities: ActivityRecord[],
  now: Date,
  limit = 5,
): ChallengeProgress[] {
  const all = challenges.map((challenge) => challengeProgress(challenge, activities, now));

  const pending = all
    .filter((item) => !item.achieved)
    // 거의 다 온 것부터 보여 줘야 "조금만 더"가 됩니다.
    // 아직 아무 기록이 없어 전부 0일 때는 목표가 낮은 것부터 보여 줍니다.
    // 그래야 첫 화면에 "이건 오늘 할 수 있겠다" 싶은 것이 옵니다.
    .sort((left, right) => right.ratio - left.ratio || left.challenge.target - right.challenge.target);

  // 갈래를 섞습니다. 안 그러면 "이번 주 2번·3번·4번"처럼 사실상 같은 도전만 늘어섭니다.
  const picked: ChallengeProgress[] = [];
  const usedCategories = new Set<ChallengeCategory>();
  for (const item of pending) {
    if (picked.length >= limit) break;
    if (usedCategories.has(item.challenge.category)) continue;
    usedCategories.add(item.challenge.category);
    picked.push(item);
  }
  // 갈래를 다 쓰고도 자리가 남으면 남은 것으로 채웁니다.
  for (const item of pending) {
    if (picked.length >= limit) break;
    if (picked.includes(item)) continue;
    picked.push(item);
  }

  const done = all.filter((item) => item.achieved).sort((left, right) => right.ratio - left.ratio);
  // 이룬 것 하나는 항상 남겨 둡니다. 성취가 사라지면 계속할 이유가 줄어듭니다.
  const keepDone = done.slice(0, 1);
  return [...picked.slice(0, Math.max(1, limit - keepDone.length)), ...keepDone];
}

/** 지금까지 이룬 도전입니다. */
export function achievedChallenges(
  activities: ActivityRecord[],
  now: Date,
): ChallengeProgress[] {
  return challenges
    .map((challenge) => challengeProgress(challenge, activities, now))
    .filter((item) => item.achieved);
}
