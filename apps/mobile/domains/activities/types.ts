// 러닝봄의 로컬 활동 기록과 공개 가능한 출처 등급을 정의합니다.
export type ActivityKind = 'run' | 'walk' | 'recovery';
export type ActivitySource = 'COACH_COMPLETED' | 'HEALTH_LINKED' | 'SELF_LOGGED' | 'CREW_ATTENDANCE';

/**
 * 러닝 중 1km마다 확정한 구간(랩) 기록입니다.
 * km은 그 구간이 끝난 지점의 누적 거리(1, 2, 3…)이고, 마지막 구간만 2.42처럼 소수가 될 수 있습니다.
 * seconds는 앞 구간이 끝난 뒤부터 이 지점까지 걸린 시간입니다.
 */
export type ActivitySplit = {
  km: number;
  seconds: number;
};

/** 지도 없이도 나중에 경로를 되살릴 수 있게 남기는 좌표입니다. t는 세션 시작 후 경과 초입니다. */
export type ActivityRoutePoint = {
  lat: number;
  lon: number;
  t: number;
};

/** 저장·표시 어디에서나 같은 상한을 쓰도록 모아 둔 값입니다. */
export const MAX_ACTIVITY_SPLITS = 200;
export const MAX_ACTIVITY_ROUTE_POINTS = 1_000;

export type ActivityRecord = {
  id: string;
  localUuid: string;
  kind: ActivityKind;
  durationMinutes: number;
  distanceKm?: number;
  source: ActivitySource;
  completedAt: string;
  timezoneId: string;
  syncedAt?: string;
  /**
   * GPS 추적(Preview 빌드)에서만 채워지는 선택 필드입니다.
   * 예전 기록에는 없으며, 없어도 모든 화면·집계가 그대로 동작해야 합니다.
   */
  splits?: ActivitySplit[];
  /** 솎아 낸 경로 좌표입니다. 마찬가지로 없어도 되는 선택 필드입니다. */
  routePoints?: ActivityRoutePoint[];
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** 저장소·동기화에서 되살린 값이 구간 기록으로 쓸 만한지 확인합니다. */
export function isActivitySplit(value: unknown): value is ActivitySplit {
  if (!value || typeof value !== 'object') return false;
  const split = value as Partial<ActivitySplit>;
  return (
    isFiniteNumber(split.km) &&
    split.km > 0 &&
    split.km <= 500 &&
    isFiniteNumber(split.seconds) &&
    split.seconds >= 0 &&
    split.seconds <= 86_400
  );
}

export function isActivityRoutePoint(value: unknown): value is ActivityRoutePoint {
  if (!value || typeof value !== 'object') return false;
  const point = value as Partial<ActivityRoutePoint>;
  return (
    isFiniteNumber(point.lat) &&
    Math.abs(point.lat) <= 90 &&
    isFiniteNumber(point.lon) &&
    Math.abs(point.lon) <= 180 &&
    isFiniteNumber(point.t) &&
    point.t >= 0
  );
}

/** 잘못된 항목은 조용히 버리고, 상한을 넘으면 앞에서부터 상한만큼만 남깁니다. */
export function sanitizeSplits(value: unknown): ActivitySplit[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const splits = value.filter(isActivitySplit).slice(0, MAX_ACTIVITY_SPLITS);
  return splits.length > 0 ? splits : undefined;
}

export function sanitizeRoutePoints(value: unknown): ActivityRoutePoint[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const points = value.filter(isActivityRoutePoint).slice(0, MAX_ACTIVITY_ROUTE_POINTS);
  return points.length > 0 ? points : undefined;
}

export const activitySourceLabels: Record<ActivitySource, string> = {
  COACH_COMPLETED: '러닝봄 코치 완주',
  HEALTH_LINKED: '건강앱에서 가져옴',
  SELF_LOGGED: '직접 입력',
  CREW_ATTENDANCE: '크루 참석',
};

export function activityCountsAsMovement(activity: ActivityRecord): boolean {
  if (activity.kind === 'recovery') return activity.durationMinutes >= 5;
  return activity.durationMinutes >= 10;
}

export function activityCountsAsCompetitiveRun(activity: ActivityRecord): boolean {
  return (
    activity.kind === 'run' &&
    activity.durationMinutes >= 10 &&
    activity.source === 'COACH_COMPLETED'
  );
}
