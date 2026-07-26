// GPS 잡음을 걸러 실제로 달린 거리만 누적하는 순수 필터입니다.
import { haversineMeters, isValidGeoPoint } from './geo';

export type LocationFix = {
  latitudeDeg: number;
  longitudeDeg: number;
  /** 수평 정확도 반경(미터). 알 수 없으면 undefined. */
  accuracyMeters?: number;
  /** 단말이 보고한 순간 속도(m/s). 알 수 없으면 undefined. */
  speedMetersPerSecond?: number;
  timestampMillis: number;
};

export type FixRejectReason =
  | 'invalid'
  | 'accuracy'
  | 'out-of-order'
  | 'gap'
  | 'stationary'
  | 'implausible-speed';

export type TrackSegment = {
  meters: number;
  millis: number;
  endTimestampMillis: number;
};

export type TrackAccumulator = {
  distanceMeters: number;
  /** 실제로 이동한 것으로 인정한 시간(밀리초). 정지 구간은 빠집니다. */
  movingMillis: number;
  acceptedCount: number;
  rejectedCount: number;
  lastRejectReason?: FixRejectReason;
  /** 거리 계산 기준점. 정지·이상치 구간에서는 앵커를 옮기지 않습니다. */
  anchor?: LocationFix;
  /** 신호 상태 표시에 쓰는 가장 최근 수신 좌표(거부된 좌표 포함). */
  lastFix?: LocationFix;
  /** 현재 페이스 계산용 최근 구간. 오래된 구간은 잘라 냅니다. */
  recentSegments: TrackSegment[];
  /** 이상치가 연속으로 몇 번 나왔는지. 일정 횟수를 넘으면 앵커를 재설정합니다. */
  implausibleStreak: number;
};

export type TrackFilterOptions = {
  /** 이 값보다 정확도가 나쁜(반경이 큰) 좌표는 버립니다. */
  maxAccuracyMeters: number;
  /** 이 속도를 넘는 구간은 GPS 튐으로 보고 거리에 넣지 않습니다. */
  maxSpeedMetersPerSecond: number;
  /** 이 거리보다 짧은 이동은 정지 중 잡음으로 봅니다. */
  minMoveMeters: number;
  /** 이 시간보다 오래 끊긴 뒤 들어온 좌표는 거리 없이 앵커만 다시 잡습니다. */
  maxGapMillis: number;
  /** 이상치가 이만큼 연속되면 실제 이동으로 보고 앵커를 옮깁니다. */
  implausibleResetCount: number;
  /** 현재 페이스를 계산할 때 살펴보는 최근 시간(밀리초). */
  recentWindowMillis: number;
};

export const defaultTrackFilterOptions: TrackFilterOptions = {
  maxAccuracyMeters: 30,
  maxSpeedMetersPerSecond: 8,
  minMoveMeters: 3,
  maxGapMillis: 30_000,
  implausibleResetCount: 3,
  recentWindowMillis: 60_000,
};

export const emptyTrackAccumulator: TrackAccumulator = {
  distanceMeters: 0,
  movingMillis: 0,
  acceptedCount: 0,
  rejectedCount: 0,
  recentSegments: [],
  implausibleStreak: 0,
};

function trimSegments(
  segments: readonly TrackSegment[],
  nowMillis: number,
  windowMillis: number,
): TrackSegment[] {
  return segments.filter((segment) => nowMillis - segment.endTimestampMillis <= windowMillis);
}

function rejected(
  accumulator: TrackAccumulator,
  fix: LocationFix,
  reason: FixRejectReason,
  options: TrackFilterOptions,
  nextAnchor?: LocationFix,
): TrackAccumulator {
  return {
    ...accumulator,
    rejectedCount: accumulator.rejectedCount + 1,
    lastRejectReason: reason,
    lastFix: reason === 'invalid' ? accumulator.lastFix : fix,
    ...(nextAnchor === undefined ? {} : { anchor: nextAnchor }),
    implausibleStreak:
      reason === 'implausible-speed' && nextAnchor === undefined
        ? accumulator.implausibleStreak + 1
        : 0,
    recentSegments: trimSegments(
      accumulator.recentSegments,
      fix.timestampMillis,
      options.recentWindowMillis,
    ),
  };
}

/**
 * 좌표 하나를 누적기에 반영합니다.
 * - 정확도가 나쁜 좌표는 버립니다.
 * - 정지 중 잡음(아주 짧은 이동)은 거리에 넣지 않고 앵커도 유지합니다.
 * - 비현실적으로 빠른 구간은 버리되, 연속되면 실제 이동으로 보고 앵커만 옮깁니다.
 */
export function acceptFix(
  accumulator: TrackAccumulator,
  fix: LocationFix,
  options: TrackFilterOptions = defaultTrackFilterOptions,
): TrackAccumulator {
  if (
    !isValidGeoPoint({ latitudeDeg: fix.latitudeDeg, longitudeDeg: fix.longitudeDeg }) ||
    !Number.isFinite(fix.timestampMillis)
  ) {
    return rejected(accumulator, fix, 'invalid', options);
  }

  if (
    fix.accuracyMeters !== undefined &&
    (!Number.isFinite(fix.accuracyMeters) || fix.accuracyMeters > options.maxAccuracyMeters)
  ) {
    return rejected(accumulator, fix, 'accuracy', options);
  }

  const anchor = accumulator.anchor;
  if (!anchor) {
    // 첫 유효 좌표는 거리 없이 기준점만 잡습니다.
    return {
      ...accumulator,
      anchor: fix,
      lastFix: fix,
      acceptedCount: accumulator.acceptedCount + 1,
      implausibleStreak: 0,
    };
  }

  const elapsedMillis = fix.timestampMillis - anchor.timestampMillis;
  if (elapsedMillis <= 0) {
    return rejected(accumulator, fix, 'out-of-order', options);
  }
  if (elapsedMillis > options.maxGapMillis) {
    // 화면이 꺼져 추적이 끊긴 구간은 거리를 지어내지 않고 기준점만 다시 잡습니다.
    return rejected(accumulator, fix, 'gap', options, fix);
  }

  const meters = haversineMeters(
    { latitudeDeg: anchor.latitudeDeg, longitudeDeg: anchor.longitudeDeg },
    { latitudeDeg: fix.latitudeDeg, longitudeDeg: fix.longitudeDeg },
  );

  if (meters < options.minMoveMeters) {
    return rejected(accumulator, fix, 'stationary', options);
  }

  const speed = meters / (elapsedMillis / 1_000);
  if (speed > options.maxSpeedMetersPerSecond) {
    const shouldReanchor = accumulator.implausibleStreak + 1 >= options.implausibleResetCount;
    return rejected(
      accumulator,
      fix,
      'implausible-speed',
      options,
      shouldReanchor ? fix : undefined,
    );
  }

  return {
    distanceMeters: accumulator.distanceMeters + meters,
    movingMillis: accumulator.movingMillis + elapsedMillis,
    acceptedCount: accumulator.acceptedCount + 1,
    rejectedCount: accumulator.rejectedCount,
    anchor: fix,
    lastFix: fix,
    implausibleStreak: 0,
    recentSegments: [
      ...trimSegments(accumulator.recentSegments, fix.timestampMillis, options.recentWindowMillis),
      { meters, millis: elapsedMillis, endTimestampMillis: fix.timestampMillis },
    ],
  };
}

/** 좌표 목록을 순서대로 필터에 통과시킨 최종 누적 상태입니다. 테스트·재계산용입니다. */
export function accumulateFixes(
  fixes: readonly LocationFix[],
  options: TrackFilterOptions = defaultTrackFilterOptions,
  initial: TrackAccumulator = emptyTrackAccumulator,
): TrackAccumulator {
  return fixes.reduce(
    (accumulator, fix) => acceptFix(accumulator, fix, options),
    initial,
  );
}
