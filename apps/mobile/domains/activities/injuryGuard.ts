// 지금까지의 기록을 보고 "오늘 무리인지"를 다정하게 알려 주는 순수 규칙입니다.
// 근거가 강한 규칙만 경고로 쓰고, 근거가 약한 규칙은 경고가 아니라 참고 안내로만 씁니다.
// 화면은 이 파일이 만든 문장을 그대로 보여 주기만 합니다.
import { addDaysKey, kstDayKey, weekStartKey } from './summary';
import type { ActivityRecord } from './types';

export type InjuryNoticeTone = 'gentle' | 'caution' | 'strong';

export type InjuryNoticeId =
  | 'two-week-jump'
  | 'long-run-110'
  | 'long-run-130'
  | 'back-to-back'
  | 'ten-percent';

export type InjuryNotice = {
  id: InjuryNoticeId;
  tone: InjuryNoticeTone;
  title: string;
  body: string;
  /** 왜 이렇게 말하는지 근거를 한 줄로 밝힙니다. */
  evidence: string;
};

export type InjuryGuardInput = {
  activities: readonly ActivityRecord[];
  now: Date;
  /** 오늘 달리려는(또는 지금 달린) 거리(km). 모르면 넣지 않습니다. */
  plannedDistanceKm?: number;
  /** 달리기를 시작한 날. 없으면 가장 오래된 기록으로 대신합니다. */
  runningStartedAt?: string;
};

/** 2주 사이에 이만큼보다 많이 늘면 알립니다. */
export const TWO_WEEK_JUMP_RATIO = 1.3;
/** 최근 30일 최장 거리 대비 이 값을 넘으면 알립니다. */
export const LONG_RUN_CAUTION_RATIO = 1.1;
/** 이 값을 넘으면 더 강하게 알립니다. */
export const LONG_RUN_STRONG_RATIO = 1.3;
/** 달리기를 시작한 지 이 기간이 안 되면 "막 시작한 사람"으로 봅니다. */
export const BEGINNER_DAYS = 180;
/** 비교 대상이 너무 짧으면 숫자가 요동쳐서 알리지 않습니다. */
export const MIN_BASELINE_KM = 5;
export const MIN_LONG_RUN_BASELINE_KM = 1;
/** 한 화면에 동시에 보여 줄 안내 수입니다. */
export const MAX_VISIBLE_INJURY_NOTICES = 2;

const toneRank: Record<InjuryNoticeTone, number> = { strong: 0, caution: 1, gentle: 2 };

function km(value: number): string {
  return `${(Math.round(value * 10) / 10).toFixed(1)}km`;
}

function percentOver(value: number, baseline: number): number {
  return Math.round((value / baseline - 1) * 100);
}

/** 부상 규칙은 "달린 거리"만 봅니다. 걷기·회복 기록은 세지 않습니다. */
function runDistanceKm(activity: ActivityRecord): number {
  if (activity.kind !== 'run') return 0;
  const distance = activity.distanceKm;
  if (typeof distance !== 'number' || !Number.isFinite(distance) || distance <= 0) return 0;
  return distance;
}

function distanceBetween(
  activities: readonly ActivityRecord[],
  fromKey: string,
  toKey: string,
): number {
  let total = 0;
  for (const activity of activities) {
    const day = kstDayKey(activity.completedAt);
    if (!day || day < fromKey || day > toKey) continue;
    total += runDistanceKm(activity);
  }
  return total;
}

function longestRunKm(
  activities: readonly ActivityRecord[],
  fromKey: string,
  toKey: string,
): number {
  let longest = 0;
  for (const activity of activities) {
    const day = kstDayKey(activity.completedAt);
    if (!day || day < fromKey || day > toKey) continue;
    longest = Math.max(longest, runDistanceKm(activity));
  }
  return longest;
}

function ranOnDay(activities: readonly ActivityRecord[], dayKey: string): boolean {
  return activities.some(
    (activity) => activity.kind === 'run' && kstDayKey(activity.completedAt) === dayKey,
  );
}

function earliestDayKey(activities: readonly ActivityRecord[]): string | undefined {
  let earliest: string | undefined;
  for (const activity of activities) {
    const day = kstDayKey(activity.completedAt);
    if (!day) continue;
    if (earliest === undefined || day < earliest) earliest = day;
  }
  return earliest;
}

function daysBetweenKeys(fromKey: string, toKey: string): number {
  const from = Date.parse(`${fromKey}T00:00:00Z`);
  const to = Date.parse(`${toKey}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.round((to - from) / 86_400_000);
}

/** 달리기를 시작한 지 6개월이 안 됐는지 봅니다. 기록이 아예 없으면 "막 시작한 사람"으로 봅니다. */
export function isNewRunner(input: InjuryGuardInput): boolean {
  const todayKey = kstDayKey(input.now);
  const startKey = input.runningStartedAt
    ? kstDayKey(input.runningStartedAt)
    : earliestDayKey(input.activities);
  if (!startKey || !todayKey) return true;
  return daysBetweenKeys(startKey, todayKey) < BEGINNER_DAYS;
}

/** 최근 2주 거리가 그 앞 2주보다 30% 넘게 늘었는지 봅니다. (근거가 강한 규칙) */
export function twoWeekJumpNotice(input: InjuryGuardInput): InjuryNotice | undefined {
  const todayKey = kstDayKey(input.now);
  if (!todayKey) return undefined;

  const recent = distanceBetween(input.activities, addDaysKey(todayKey, -13), todayKey);
  const previous = distanceBetween(
    input.activities,
    addDaysKey(todayKey, -27),
    addDaysKey(todayKey, -14),
  );
  if (previous < MIN_BASELINE_KM) return undefined;
  if (recent <= previous * TWO_WEEK_JUMP_RATIO) return undefined;

  return {
    id: 'two-week-jump',
    tone: 'caution',
    title: '요즘 거리가 꽤 늘었어요',
    body: `최근 2주 동안 ${km(recent)}를 달렸어요. 그 앞 2주 ${km(previous)}보다 ${percentOver(
      recent,
      previous,
    )}% 늘었어요. 2주 사이에 30%보다 많이 늘리면 다치는 사람이 늘었다는 연구가 있어요. 이번 주는 지금만큼만 달려도 충분해요. 천천히 가도 괜찮아요.`,
    evidence: '러너 874명을 1년 넘게 따라간 연구',
  };
}

/** 오늘 달리려는 거리가 최근 30일 최장 거리보다 많이 긴지 봅니다. (근거가 강한 규칙) */
export function longRunNotice(input: InjuryGuardInput): InjuryNotice | undefined {
  const planned = input.plannedDistanceKm;
  if (typeof planned !== 'number' || !Number.isFinite(planned) || planned <= 0) return undefined;

  const todayKey = kstDayKey(input.now);
  if (!todayKey) return undefined;

  // 오늘 기록과 견주면 자기 자신과 비교하게 되므로 어제까지만 봅니다.
  const longest = longestRunKm(
    input.activities,
    addDaysKey(todayKey, -29),
    addDaysKey(todayKey, -1),
  );
  if (longest < MIN_LONG_RUN_BASELINE_KM) return undefined;

  const percent = percentOver(planned, longest);
  if (planned > longest * LONG_RUN_STRONG_RATIO) {
    return {
      id: 'long-run-130',
      tone: 'strong',
      title: '오늘은 많이 긴 거리예요',
      body: `최근 30일 중 가장 길게 달린 거리는 ${km(longest)}였어요. 오늘 ${km(
        planned,
      )}는 그보다 ${percent}% 길어요. 한 번에 달리는 거리를 이렇게 갑자기 늘리면 다칠 가능성이 약 64% 올라간다는 연구가 있어요. 오늘은 ${km(
        longest * LONG_RUN_CAUTION_RATIO,
      )}쯤에서 멈추는 걸 권해요.`,
      evidence: '한 번에 달리는 거리를 30% 넘게 늘린 러너들을 살펴본 연구',
    };
  }
  if (planned > longest * LONG_RUN_CAUTION_RATIO) {
    return {
      id: 'long-run-110',
      tone: 'caution',
      title: '오늘은 평소보다 조금 긴 거리예요',
      body: `최근 30일 중 가장 길게 달린 거리는 ${km(longest)}였어요. 오늘 ${km(
        planned,
      )}는 그보다 ${percent}% 길어요. 중간에 걸어도 괜찮고, 조금 줄여도 괜찮아요.`,
      evidence: '한 번에 달리는 거리를 갑자기 늘렸을 때 다치는 사람이 늘었다는 연구',
    };
  }
  return undefined;
}

/** 막 시작한 사람이 이틀 이어서 달리게 되는지 봅니다. (근거가 강한 규칙) */
export function backToBackNotice(input: InjuryGuardInput): InjuryNotice | undefined {
  const todayKey = kstDayKey(input.now);
  if (!todayKey) return undefined;
  if (!isNewRunner(input)) return undefined;
  if (!ranOnDay(input.activities, addDaysKey(todayKey, -1))) return undefined;

  return {
    id: 'back-to-back',
    tone: 'gentle',
    title: '이틀 이어서 달리게 돼요',
    body: '어제도 달렸어요. 달리기를 시작한 지 6개월이 안 됐을 때는 하루 쉬면 몸이 더 튼튼해져요. 오늘은 가볍게 걷기만 해도 좋아요. 그래도 달리고 싶다면 짧고 편하게 다녀오세요.',
    evidence: '달리기를 막 시작한 사람은 쉬는 날을 끼울 때 덜 다친다는 권고',
  };
}

/**
 * 흔히 말하는 "일주일에 10%만 늘리기"입니다.
 * 큰 연구에서 예측력이 우연 수준이었기 때문에 경고가 아니라 참고 안내로만 씁니다.
 */
export function tenPercentHint(input: InjuryGuardInput): InjuryNotice | undefined {
  const todayKey = kstDayKey(input.now);
  if (!todayKey) return undefined;

  const thisWeekStart = weekStartKey(todayKey);
  const lastWeekStart = addDaysKey(thisWeekStart, -7);
  const thisWeek = distanceBetween(input.activities, thisWeekStart, todayKey);
  const lastWeek = distanceBetween(input.activities, lastWeekStart, addDaysKey(thisWeekStart, -1));
  if (lastWeek < MIN_BASELINE_KM) return undefined;
  if (thisWeek <= lastWeek * 1.1) return undefined;

  return {
    id: 'ten-percent',
    tone: 'gentle',
    title: '참고만 해 주세요',
    body: `이번 주 거리 ${km(thisWeek)}가 지난주 ${km(lastWeek)}보다 ${percentOver(
      thisWeek,
      lastWeek,
    )}% 늘었어요. 흔히 말하는 "일주일에 10%만 늘리기"는 5,200명을 살펴본 연구에서 다칠 사람을 거의 맞히지 못했어요. 그래서 경고가 아니라 참고로만 알려 드려요. 몸이 아프지 않으면 그대로 가도 괜찮아요.`,
    evidence: '러너 5,200여 명을 견줘 본 연구에서 10% 규칙의 예측력은 우연 수준이었어요',
  };
}

/**
 * 오늘 보여 줄 안내를 모읍니다.
 * 근거가 강한 규칙이 먼저 오고, 근거가 약한 10% 안내는 다른 안내가 없을 때만 붙입니다.
 */
export function injuryNotices(input: InjuryGuardInput): InjuryNotice[] {
  const strong = [twoWeekJumpNotice(input), longRunNotice(input), backToBackNotice(input)].filter(
    (notice): notice is InjuryNotice => notice !== undefined,
  );

  const notices = strong.length > 0 ? strong : [tenPercentHint(input)].filter(
    (notice): notice is InjuryNotice => notice !== undefined,
  );

  return notices.sort((left, right) => toneRank[left.tone] - toneRank[right.tone]);
}
