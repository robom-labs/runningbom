// 기기에 저장된 활동과 예정 일정을 달력 날짜와 일일 요약으로 바꾸는 순수 규칙입니다.
import type { RunPlan } from './plans';
import type { ActivityRecord } from './types';

export type ActivityCalendarDay = {
  key: string;
  day: number;
  inMonth: boolean;
  activities: ActivityRecord[];
  plans: RunPlan[];
  totalMinutes: number;
  distanceKm: number;
  intensity: 0 | 1 | 2 | 3;
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

// 도트 강도는 그날의 활동 시간 구간 표시일 뿐이며 건강 판단이 아닙니다.
export function intensityForMinutes(totalMinutes: number): 0 | 1 | 2 | 3 {
  if (totalMinutes <= 0) return 0;
  if (totalMinutes < 30) return 1;
  if (totalMinutes < 60) return 2;
  return 3;
}

export function activityCalendarMonth(
  activities: ActivityRecord[],
  month: Date,
  plans: RunPlan[] = [],
): ActivityCalendarDay[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const grouped = activitiesByLocalDate(activities);
  const plannedByDate = new Map<string, RunPlan[]>();
  for (const plan of plans) {
    plannedByDate.set(plan.date, [...(plannedByDate.get(plan.date) ?? []), plan]);
  }
  return Array.from({ length: 42 }, (_, index) => {
    const value = new Date(start);
    value.setDate(start.getDate() + index);
    const key = dateKey(value);
    const values = grouped.get(key) ?? [];
    const totalMinutes = values.reduce((total, activity) => total + activity.durationMinutes, 0);
    return {
      key,
      day: value.getDate(),
      inMonth: value.getMonth() === month.getMonth(),
      activities: values,
      plans: plannedByDate.get(key) ?? [],
      totalMinutes,
      distanceKm:
        Math.round(values.reduce((total, activity) => total + (activity.distanceKm ?? 0), 0) * 100) /
        100,
      intensity: intensityForMinutes(totalMinutes),
    };
  });
}
