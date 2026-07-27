// 러닝봄이 기본으로 여는 도전 목록입니다. 목록을 손으로 갱신하지 않고 오늘 날짜에서 계산해
// 매달·매주 자동으로 새 기간이 열립니다. 없는 사람(참가자 수)이나 없는 숫자는 만들지 않습니다.
import { addDaysKey, kstDayKey, weekStartKey } from '../activities/summary';
import type { Challenge } from './types';

/** 한국 날짜 두 개 사이의 날 수입니다. (뒤 - 앞) */
export function daysBetween(fromDay: string, toDay: string): number {
  const from = Date.parse(`${fromDay}T00:00:00Z`);
  const to = Date.parse(`${toDay}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.round((to - from) / 86_400_000);
}

export type DayRange = { startDay: string; endDay: string };

/** 그 날이 속한 달의 1일 ~ 말일입니다. */
export function monthRange(dayKey: string): DayRange {
  const startDay = `${dayKey.slice(0, 7)}-01`;
  const year = Number(dayKey.slice(0, 4));
  const month = Number(dayKey.slice(5, 7));
  const lastDate = new Date(Date.UTC(year, month, 0));
  return { startDay, endDay: lastDate.toISOString().slice(0, 10) };
}

/** 그 날이 속한 주의 월요일 ~ 일요일입니다(주간 합계와 같은 기준). */
export function weekRange(dayKey: string): DayRange {
  const startDay = weekStartKey(dayKey);
  return { startDay, endDay: addDaysKey(startDay, 6) };
}

/** 화면에 쓰는 기간 표기입니다. 예: "7월 1일 ~ 7월 31일" */
export function formatDayRange(range: DayRange): string {
  const label = (day: string) => `${Number(day.slice(5, 7))}월 ${Number(day.slice(8, 10))}일`;
  return `${label(range.startDay)} ~ ${label(range.endDay)}`;
}

/** 목표 대회 준비 도전을 만들 때 필요한 값만 받습니다(대회 데이터는 읽기만 합니다). */
export type GoalRaceSeed = {
  raceId: string;
  name: string;
  raceDate: string;
  /** 목표 대회를 정한 시각입니다. 이 날부터 준비 기간을 셉니다. */
  savedAt: string;
};

/** 대회까지 남은 주에 맞춰 "몇 번 달리기"를 정합니다. 주 3회 기준, 최소 4번 최대 60번입니다. */
export function raceRunTarget(daysLeft: number): number {
  const byWeeks = Math.round((daysLeft / 7) * 3);
  return Math.max(4, Math.min(60, byWeeks));
}

export function raceChallenge(seed: GoalRaceSeed, now: number = Date.now()): Challenge | undefined {
  const today = kstDayKey(new Date(now));
  if (!today || seed.raceDate <= today) return undefined;
  const savedDay = kstDayKey(seed.savedAt);
  const startDay = savedDay && savedDay < seed.raceDate ? savedDay : today;
  const target = raceRunTarget(daysBetween(today, seed.raceDate));
  return {
    id: `race:${seed.raceId}:${seed.raceDate}`,
    title: `${seed.name} 준비`,
    summary: `대회 날까지 ${target}번 달려요.`,
    startDay,
    endDay: seed.raceDate,
    goal: { metric: 'sessions', target, kinds: ['run'] },
    origin: 'race',
  };
}

/** 이번 달에 열리는 기본 도전입니다. */
export function monthlyChallenges(dayKey: string): Challenge[] {
  const range = monthRange(dayKey);
  const month = dayKey.slice(0, 7);
  return [
    {
      id: `builtin:month-distance-30:${month}`,
      title: '이번 달 30km 달리기',
      summary: '한 달 동안 30km를 채워요. 처음 도전하기 좋아요.',
      ...range,
      goal: { metric: 'distance', target: 30 },
      origin: 'builtin',
    },
    {
      id: `builtin:month-distance-50:${month}`,
      title: '이번 달 50km 달리기',
      summary: '한 달 동안 50km를 채워요.',
      ...range,
      goal: { metric: 'distance', target: 50 },
      origin: 'builtin',
    },
    {
      id: `builtin:month-distance-100:${month}`,
      title: '이번 달 100km 달리기',
      summary: '한 달 동안 100km를 채워요. 꾸준히 달리는 분께 맞아요.',
      ...range,
      goal: { metric: 'distance', target: 100 },
      origin: 'builtin',
    },
    {
      id: `builtin:month-runs-10:${month}`,
      title: '이번 달 10번 달리기',
      summary: '거리는 상관없어요. 달린 횟수만 세요.',
      ...range,
      goal: { metric: 'sessions', target: 10, kinds: ['run'] },
      origin: 'builtin',
    },
    {
      id: `builtin:month-long-5:${month}`,
      title: '30분 이상 5번',
      summary: '한 번에 30분 넘게, 이번 달에 다섯 번이요.',
      ...range,
      goal: { metric: 'sessions', target: 5, minMinutes: 30 },
      origin: 'builtin',
    },
  ];
}

/** 이번 주에 열리는 기본 도전입니다. */
export function weeklyChallenges(dayKey: string): Challenge[] {
  const range = weekRange(dayKey);
  return [
    {
      id: `builtin:week-active-days-3:${range.startDay}`,
      title: '이번 주 3일 움직이기',
      summary: '달려도 걸어도 좋아요. 사흘만 몸을 움직여요.',
      ...range,
      goal: { metric: 'activeDays', target: 3 },
      origin: 'builtin',
    },
  ];
}

/**
 * 오늘 기준으로 열려 있는 기본 도전 전부입니다.
 * 목록을 저장해 두지 않으므로 달이 바뀌면 다음 달 도전이 저절로 나옵니다.
 */
export function builtInChallenges(
  now: number = Date.now(),
  goalRace?: GoalRaceSeed,
): Challenge[] {
  const today = kstDayKey(new Date(now));
  if (!today) return [];
  const race = goalRace ? raceChallenge(goalRace, now) : undefined;
  return [
    ...weeklyChallenges(today),
    ...monthlyChallenges(today),
    ...(race ? [race] : []),
  ];
}
