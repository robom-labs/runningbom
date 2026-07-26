// 저장된 활동 기록에서 평균 페이스를 되살리는 순수 계산기입니다.
// 저장 스키마는 그대로 두고(기존 distanceKm 키만 사용) 페이스는 항상 파생값으로 구합니다.
import type { ActivityRecord } from './types';

export type ActivityDistanceInput = {
  durationMinutes: number;
  distanceKm?: number;
};

/** 기록의 거리와 시간에서 1km당 초를 구합니다. 거리가 없으면 undefined입니다. */
export function activityPaceSecondsPerKm(
  activity: ActivityDistanceInput,
): number | undefined {
  const distanceKm = activity.distanceKm;
  if (distanceKm === undefined || !Number.isFinite(distanceKm) || distanceKm <= 0) {
    return undefined;
  }
  if (!Number.isFinite(activity.durationMinutes) || activity.durationMinutes <= 0) {
    return undefined;
  }
  return (activity.durationMinutes * 60) / distanceKm;
}

/** 5'30" 형태. 거리가 없어 계산할 수 없으면 '거리 없음'을 돌려줍니다. */
export function formatActivityPace(activity: ActivityDistanceInput): string {
  const pace = activityPaceSecondsPerKm(activity);
  if (pace === undefined) return '거리 없음';
  const rounded = Math.round(pace);
  return `${Math.floor(rounded / 60)}'${String(rounded % 60).padStart(2, '0')}"`;
}

/**
 * 추적으로 얻은 거리를 활동 기록 입력에 덧붙입니다.
 * 기존 필드는 그대로 두고 distanceKm만 더하며, 저장 가능한 범위를 벗어나면 넣지 않습니다.
 */
export function withTrackedDistance<T extends object>(
  input: T,
  distanceKm?: number,
): T & { distanceKm?: number } {
  if (
    distanceKm === undefined ||
    !Number.isFinite(distanceKm) ||
    distanceKm <= 0 ||
    distanceKm > 500
  ) {
    return input;
  }
  return { ...input, distanceKm: Math.round(distanceKm * 100) / 100 };
}

/** 거리가 있는 기록만 모아 평균 페이스를 구합니다. 없으면 undefined입니다. */
export function averagePaceForActivities(
  activities: readonly ActivityRecord[],
): number | undefined {
  const measured = activities.filter(
    (activity) => activity.distanceKm !== undefined && activity.distanceKm > 0,
  );
  if (measured.length === 0) return undefined;

  const distanceKm = measured.reduce((total, activity) => total + (activity.distanceKm ?? 0), 0);
  const minutes = measured.reduce((total, activity) => total + activity.durationMinutes, 0);
  if (distanceKm <= 0 || minutes <= 0) return undefined;
  return (minutes * 60) / distanceKm;
}
