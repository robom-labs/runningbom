// 기기에 저장된 활동을 달력 날짜와 일일 요약으로 바꾸는 순수 규칙입니다.
import type { ActivityRecord } from './types';

export type ActivityCalendarDay = {
  key: string;
  day: number;
  inMonth: boolean;
  activities: ActivityRecord[];
  totalMinutes: number;
  distanceKm: number;
};

function dateKey(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export function activitiesByLocalDate(activities: ActivityRecord[]): Map<string, ActivityRecord[]> {
  const result = new Map<string, ActivityRecord[]>();
  for (const activity of activities) {
    const day = new Date(activity.completedAt);
    if (Number.isNaN(day.valueOf())) continue;
    const key = dateKey(day);
    result.set(key, [...(result.get(key) ?? []), activity]);
  }
  return result;
}

export function activityCalendarMonth(
  activities: ActivityRecord[],
  month: Date,
): ActivityCalendarDay[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const grouped = activitiesByLocalDate(activities);
  return Array.from({ length: 42 }, (_, index) => {
    const value = new Date(start);
    value.setDate(start.getDate() + index);
    const values = grouped.get(dateKey(value)) ?? [];
    return {
      key: dateKey(value),
      day: value.getDate(),
      inMonth: value.getMonth() === month.getMonth(),
      activities: values,
      totalMinutes: values.reduce((total, activity) => total + activity.durationMinutes, 0),
      distanceKm: values.reduce((total, activity) => total + (activity.distanceKm ?? 0), 0),
    };
  });
}
