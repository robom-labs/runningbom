// 저장된 활동을 주간·월간 합계로 바꾸는 순수 계산입니다. (한국 시간 기준)
import type { ActivityRecord } from './types';
import { activityCountsAsMovement } from './types';

export type PeriodTotals = {
  sessions: number;
  minutes: number;
  distanceKm: number;
  activeDays: number;
};

export const emptyTotals: PeriodTotals = {
  sessions: 0,
  minutes: 0,
  distanceKm: 0,
  activeDays: 0,
};

const kstDayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' });

export function kstDayKey(value: string | Date): string {
  const input = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(input.valueOf())) return '';
  return kstDayFormatter.format(input);
}

// 월요일을 주의 시작으로 봅니다.
export function weekStartKey(dayKey: string): string {
  const date = new Date(`${dayKey}T00:00:00Z`);
  const weekday = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - (weekday === 0 ? 6 : weekday - 1));
  return date.toISOString().slice(0, 10);
}

export function addDaysKey(dayKey: string, days: number): string {
  const date = new Date(`${dayKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function monthKey(dayKey: string): string {
  return dayKey.slice(0, 7);
}

export function totalsForKeys(
  activities: ActivityRecord[],
  includes: (dayKey: string) => boolean,
): PeriodTotals {
  const days = new Set<string>();
  let sessions = 0;
  let minutes = 0;
  let distanceKm = 0;
  for (const activity of activities) {
    const day = kstDayKey(activity.completedAt);
    if (!day || !includes(day)) continue;
    sessions += 1;
    minutes += activity.durationMinutes;
    distanceKm += activity.distanceKm ?? 0;
    if (activityCountsAsMovement(activity)) days.add(day);
  }
  return {
    sessions,
    minutes,
    distanceKm: Math.round(distanceKm * 100) / 100,
    activeDays: days.size,
  };
}

export function totalsForWeek(
  activities: ActivityRecord[],
  weekStart: string,
): PeriodTotals {
  const weekEnd = addDaysKey(weekStart, 6);
  return totalsForKeys(activities, (day) => day >= weekStart && day <= weekEnd);
}

export function totalsForMonth(
  activities: ActivityRecord[],
  month: string,
): PeriodTotals {
  return totalsForKeys(activities, (day) => monthKey(day) === month);
}

export function currentWeekStart(now: Date | number = Date.now()): string {
  return weekStartKey(kstDayKey(new Date(now)));
}

export function currentMonth(now: Date | number = Date.now()): string {
  return monthKey(kstDayKey(new Date(now)));
}

// 최근 완료된 주 4개(이번 주 제외)의 평균입니다. 기록이 없는 주는 평균에서 제외합니다.
export function recentWeeklyAverage(
  activities: ActivityRecord[],
  now: Date | number = Date.now(),
  weeks = 4,
): PeriodTotals & { measuredWeeks: number } {
  const thisWeek = currentWeekStart(now);
  const collected: PeriodTotals[] = [];
  for (let index = 1; index <= weeks; index += 1) {
    const start = addDaysKey(thisWeek, -7 * index);
    const totals = totalsForWeek(activities, start);
    if (totals.sessions > 0) collected.push(totals);
  }
  if (collected.length === 0) return { ...emptyTotals, measuredWeeks: 0 };
  const divide = (value: number) => Math.round((value / collected.length) * 100) / 100;
  return {
    sessions: divide(collected.reduce((total, item) => total + item.sessions, 0)),
    minutes: divide(collected.reduce((total, item) => total + item.minutes, 0)),
    distanceKm: divide(collected.reduce((total, item) => total + item.distanceKm, 0)),
    activeDays: divide(collected.reduce((total, item) => total + item.activeDays, 0)),
    measuredWeeks: collected.length,
  };
}

export function formatDistance(km: number): string {
  return `${(Math.round(km * 10) / 10).toFixed(1)}km`;
}

export function formatDuration(minutes: number): string {
  const whole = Math.round(minutes);
  if (whole < 60) return `${whole}분`;
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  return rest === 0 ? `${hours}시간` : `${hours}시간 ${rest}분`;
}
