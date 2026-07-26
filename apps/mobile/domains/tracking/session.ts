// 위치 권한 상태와 누적기를 화면이 그대로 그릴 수 있는 하나의 스냅샷으로 정리합니다.
import { roundedKilometers } from './geo';
import {
  defaultTrackFilterOptions,
  emptyTrackAccumulator,
  type TrackAccumulator,
  type TrackFilterOptions,
} from './filter';
import { averagePaceSecondsPerKm, currentPaceSecondsPerKm } from './pace';

/** 위치 추적이 지금 어떤 상태인지. 'denied'와 'unsupported'는 오류가 아니라 정상 경로입니다. */
export type TrackingPermissionState =
  | 'unsupported'
  | 'undetermined'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'services-off';

export type GpsSignalLevel = 'unavailable' | 'searching' | 'weak' | 'good';

export type TrackingSnapshot = {
  /** 거리 측정이 실제로 되고 있는지. false면 화면은 '측정 안 함'을 보여 줍니다. */
  measuring: boolean;
  distanceMeters: number;
  distanceKm: number;
  averagePaceSecondsPerKm?: number;
  currentPaceSecondsPerKm?: number;
  signal: GpsSignalLevel;
  /** 사용자가 바로 이해할 수 있는 한 줄 상태 설명입니다. */
  statusLabel: string;
  statusDetail: string;
};

export const signalLabels: Record<GpsSignalLevel, string> = {
  unavailable: 'GPS 없음',
  searching: 'GPS 찾는 중',
  weak: 'GPS 약함',
  good: 'GPS 양호',
};

export type SignalInput = {
  permission: TrackingPermissionState;
  accumulator: TrackAccumulator;
  nowMillis: number;
};

/**
 * 마지막 좌표의 신선도와 정확도로 신호 등급을 정합니다.
 * 권한이 없거나 서비스가 꺼져 있으면 신호를 추정하지 않습니다.
 */
export function gpsSignalLevel(
  input: SignalInput,
  options: TrackFilterOptions = defaultTrackFilterOptions,
): GpsSignalLevel {
  if (input.permission !== 'granted') return 'unavailable';

  const lastFix = input.accumulator.lastFix;
  if (!lastFix) return 'searching';

  const ageMillis = input.nowMillis - lastFix.timestampMillis;
  if (ageMillis > options.maxGapMillis) return 'searching';
  if (ageMillis > options.maxGapMillis / 2) return 'weak';

  const accuracy = lastFix.accuracyMeters;
  if (accuracy === undefined) return 'good';
  if (accuracy > options.maxAccuracyMeters) return 'weak';
  if (accuracy > options.maxAccuracyMeters / 2) return 'weak';
  return 'good';
}

const permissionDetails: Record<TrackingPermissionState, string> = {
  unsupported: '이 빌드에서는 GPS 거리 측정을 제공하지 않아요. 시간 기반 코칭만 진행해요.',
  undetermined: '아직 위치 권한을 확인하지 않았어요. 시간 기반 코칭은 그대로 진행돼요.',
  requesting: '위치 권한을 확인하고 있어요.',
  granted: '',
  denied: '위치 권한이 없어 거리는 측정하지 않아요. 시간 기반 코칭은 그대로 진행돼요.',
  'services-off': '기기 위치 서비스가 꺼져 있어 거리는 측정하지 않아요. 코칭은 계속돼요.',
};

const signalDetails: Record<GpsSignalLevel, string> = {
  unavailable: '거리를 측정하지 않고 있어요.',
  searching: '위성을 찾는 중이라 거리가 잠시 멈춰 보일 수 있어요.',
  weak: '신호가 약해 거리가 실제보다 적게 쌓일 수 있어요.',
  good: '화면이 켜져 있는 동안만 위치를 받아요. 화면이 꺼지면 그 구간 거리는 빠져요.',
};

/** 화면이 그대로 렌더링할 수 있는 추적 스냅샷을 만듭니다. */
export function trackingSnapshot(
  input: {
    permission: TrackingPermissionState;
    accumulator: TrackAccumulator;
    elapsedSeconds: number;
    nowMillis: number;
  },
  options: TrackFilterOptions = defaultTrackFilterOptions,
): TrackingSnapshot {
  const measuring = input.permission === 'granted';
  const accumulator = measuring ? input.accumulator : emptyTrackAccumulator;
  const signal = gpsSignalLevel(
    { permission: input.permission, accumulator: input.accumulator, nowMillis: input.nowMillis },
    options,
  );

  const average = measuring
    ? averagePaceSecondsPerKm(accumulator.distanceMeters, input.elapsedSeconds)
    : undefined;
  const current = measuring ? currentPaceSecondsPerKm(accumulator, options) : undefined;

  return {
    measuring,
    distanceMeters: accumulator.distanceMeters,
    distanceKm: roundedKilometers(accumulator.distanceMeters),
    ...(average === undefined ? {} : { averagePaceSecondsPerKm: average }),
    ...(current === undefined ? {} : { currentPaceSecondsPerKm: current }),
    signal,
    statusLabel: measuring ? signalLabels[signal] : '측정 안 함',
    statusDetail: measuring ? signalDetails[signal] : permissionDetails[input.permission],
  };
}

/**
 * 세션 종료 시 활동 기록에 넣을 값입니다.
 * 기존 저장 키(distanceKm)만 쓰고, 신뢰할 수 없는 거리는 아예 넣지 않습니다.
 */
export function trackedDistanceForActivity(
  snapshot: TrackingSnapshot,
  minimumKm = 0.05,
): number | undefined {
  if (!snapshot.measuring) return undefined;
  if (snapshot.distanceKm < minimumKm) return undefined;
  if (snapshot.distanceKm > 500) return undefined;
  return snapshot.distanceKm;
}
