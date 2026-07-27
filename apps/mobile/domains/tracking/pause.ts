// 일시정지 중 받은 GPS 좌표를 거리로 더하지 않고, 다시 시작할 기준점으로만 옮깁니다.
import {
  acceptFix,
  defaultTrackFilterOptions,
  emptyTrackAccumulator,
  type LocationFix,
  type TrackAccumulator,
  type TrackFilterOptions,
} from './filter';

/**
 * 일시정지 중 움직였거나 GPS가 흔들린 거리를 다음 재개 구간에 섞지 않도록 기준점만 갱신합니다.
 * 좌표 검증은 기존 acceptFix 규칙을 그대로 사용하고, 누적 거리·이동 시간은 절대 늘리지 않습니다.
 */
export function reanchorTrackWithoutDistance(
  accumulator: TrackAccumulator,
  fix: LocationFix,
  options: TrackFilterOptions = defaultTrackFilterOptions,
): TrackAccumulator {
  const probe = acceptFix(emptyTrackAccumulator, fix, options);
  if (!probe.anchor) {
    return {
      ...accumulator,
      rejectedCount: accumulator.rejectedCount + probe.rejectedCount,
      ...(probe.lastFix === undefined ? {} : { lastFix: probe.lastFix }),
      ...(probe.lastRejectReason === undefined
        ? {}
        : { lastRejectReason: probe.lastRejectReason }),
    };
  }

  const { lastRejectReason: _lastRejectReason, ...current } = accumulator;
  return {
    ...current,
    anchor: probe.anchor,
    lastFix: probe.lastFix,
    acceptedCount: accumulator.acceptedCount + probe.acceptedCount,
    recentSegments: [],
    implausibleStreak: 0,
  };
}
