// 러닝 경로 좌표를 "솎아서" 남기는 순수 로직입니다.
// 지도 라이브러리는 쓰지 않고 좌표만 정확히 남겨, 나중에 지도가 붙어도 그대로 그릴 수 있게 합니다.
import {
  MAX_ACTIVITY_ROUTE_POINTS,
  type ActivityRoutePoint,
} from '../activities/types';
import type { LocationFix } from './filter';
import { haversineMeters, isValidGeoPoint } from './geo';

export type RouteThinningOptions = {
  /** 마지막으로 저장한 좌표에서 이만큼 움직이면 새 좌표를 남깁니다. */
  minMoveMeters: number;
  /** 거의 직선으로 달려도 이 시간이 지나면 한 점은 남깁니다. */
  minIntervalMillis: number;
  /** 활동 하나가 가질 수 있는 최대 좌표 수입니다. */
  maxPoints: number;
  /** 좌표 소수 자릿수. 5자리는 약 1.1m 해상도라 러닝 경로에 충분합니다. */
  coordinateDecimals: number;
};

export const defaultRouteThinningOptions: RouteThinningOptions = {
  minMoveMeters: 10,
  minIntervalMillis: 5_000,
  maxPoints: MAX_ACTIVITY_ROUTE_POINTS,
  coordinateDecimals: 5,
};

export type RouteState = {
  points: ActivityRoutePoint[];
  /** 마지막으로 저장한 원본 좌표. 다음 좌표와의 거리를 재는 기준입니다. */
  lastKept?: LocationFix;
  /** 세션 시작 시각(ms). t(경과 초)를 계산하는 기준입니다. */
  startedAtMillis?: number;
  /** 상한을 넘어 다운샘플할 때마다 두 배가 되는 간격 배수입니다. */
  spacingScale: number;
  /** 솎여서 버린 좌표 수(디버깅·표시용). */
  skipped: number;
  /** 다운샘플을 몇 번 했는지. */
  downsampleCount: number;
};

export const emptyRouteState: RouteState = {
  points: [],
  spacingScale: 1,
  skipped: 0,
  downsampleCount: 0,
};

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * 좌표를 균등 간격으로 줄입니다. 첫 점과 마지막 점은 항상 남깁니다.
 * 상한을 넘겼을 때만 쓰며, 남은 좌표의 시간 간격은 대체로 두 배가 됩니다.
 */
export function downsampleRoute(
  points: readonly ActivityRoutePoint[],
  maxPoints: number,
): ActivityRoutePoint[] {
  const limit = Math.max(2, Math.floor(maxPoints));
  if (points.length <= limit) return [...points];

  const last = points.length - 1;
  const picked: ActivityRoutePoint[] = [];
  let previousIndex = -1;
  for (let step = 0; step < limit; step += 1) {
    const index = Math.round((step * last) / (limit - 1));
    if (index === previousIndex) continue;
    previousIndex = index;
    const point = points[index];
    if (point) picked.push(point);
  }
  return picked;
}

/**
 * 좌표 하나를 경로에 반영합니다.
 * - 잘못된 좌표·시간 역행은 버립니다.
 * - 최소 이동거리(기본 10m)나 최소 시간 간격(기본 5초)을 넘겨야 저장합니다.
 * - 상한(기본 1000개)을 넘으면 균등 간격으로 절반까지 줄이고, 이후 간격 기준을 두 배로 늘립니다.
 */
export function appendRouteFix(
  state: RouteState,
  fix: LocationFix,
  options: RouteThinningOptions = defaultRouteThinningOptions,
): RouteState {
  if (
    !isValidGeoPoint({ latitudeDeg: fix.latitudeDeg, longitudeDeg: fix.longitudeDeg }) ||
    !Number.isFinite(fix.timestampMillis)
  ) {
    return state;
  }

  const startedAtMillis = state.startedAtMillis ?? fix.timestampMillis;
  const lastKept = state.lastKept;

  if (lastKept) {
    const elapsedMillis = fix.timestampMillis - lastKept.timestampMillis;
    if (elapsedMillis <= 0) return state;

    const movedMeters = haversineMeters(
      { latitudeDeg: lastKept.latitudeDeg, longitudeDeg: lastKept.longitudeDeg },
      { latitudeDeg: fix.latitudeDeg, longitudeDeg: fix.longitudeDeg },
    );
    const keep =
      movedMeters >= options.minMoveMeters * state.spacingScale ||
      elapsedMillis >= options.minIntervalMillis * state.spacingScale;
    if (!keep) {
      return { ...state, skipped: state.skipped + 1 };
    }
  }

  const point: ActivityRoutePoint = {
    lat: round(fix.latitudeDeg, options.coordinateDecimals),
    lon: round(fix.longitudeDeg, options.coordinateDecimals),
    t: Math.max(0, Math.round((fix.timestampMillis - startedAtMillis) / 1_000)),
  };

  let points = [...state.points, point];
  let spacingScale = state.spacingScale;
  let downsampleCount = state.downsampleCount;

  if (points.length > options.maxPoints) {
    points = downsampleRoute(points, Math.max(2, Math.floor(options.maxPoints / 2)));
    spacingScale *= 2;
    downsampleCount += 1;
  }

  return {
    points,
    lastKept: fix,
    startedAtMillis,
    spacingScale,
    skipped: state.skipped,
    downsampleCount,
  };
}

/** 세션을 끝낼 때 기록에 넣을 좌표 목록입니다. 상한을 넘으면 한 번 더 균등하게 줄입니다. */
export function routePointsForActivity(
  state: RouteState,
  maxPoints: number = defaultRouteThinningOptions.maxPoints,
): ActivityRoutePoint[] | undefined {
  if (state.points.length < 2) return undefined;
  const points =
    state.points.length > maxPoints ? downsampleRoute(state.points, maxPoints) : state.points;
  return [...points];
}

/** "경로 좌표 128개 저장됨"처럼 보여 줄 짧은 문구입니다. */
export function routePointSummary(count: number): string {
  if (count <= 0) return '경로 좌표는 아직 없어요.';
  return `경로 좌표 ${count}개 저장됨`;
}
