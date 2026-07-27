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

/** 화면이 크게 보여 줄 빈 상태·오류 안내입니다. 문제가 없으면 undefined입니다. */
export type TrackingNotice = {
  /** 'info'는 정상 경로(측정 안 함), 'warning'은 사용자가 조치할 수 있는 상태입니다. */
  tone: 'info' | 'warning';
  title: string;
  body: string;
  /** 무엇을 하면 되는지 알려 주는 한 줄입니다. */
  action?: string;
};

/**
 * 권한·신호·빌드 상태를 사용자가 바로 이해할 수 있는 안내로 바꿉니다.
 * 어느 상태도 "오류"로 몰지 않고, 코칭은 계속된다는 사실을 항상 함께 알립니다.
 * (expo 모듈에 의존하지 않도록 빌드 지원 여부는 호출자가 넘겨 줍니다.)
 */
export function trackingNotice(input: {
  supported: boolean;
  permission: TrackingPermissionState;
  signal: GpsSignalLevel;
}): TrackingNotice | undefined {
  if (!input.supported || input.permission === 'unsupported') {
    return {
      tone: 'info',
      title: '이 빌드는 시간 기반 코칭만 해요',
      body: 'GPS 거리 측정은 Preview 빌드에서만 제공해요. 코칭 음성과 시간 기록은 그대로 진행돼요.',
      action: '거리·페이스가 필요하면 러닝봄 Preview 빌드를 설치해 주세요.',
    };
  }

  switch (input.permission) {
    case 'requesting':
      return {
        tone: 'info',
        title: '위치 권한을 확인하고 있어요',
        body: '허용하면 바로 거리와 페이스가 쌓이기 시작해요.',
      };
    case 'undetermined':
      return {
        tone: 'info',
        title: '아직 위치 권한을 확인하지 않았어요',
        body: '러닝을 시작하면 앱을 쓰는 동안에만 쓰는 위치 권한을 한 번 물어봐요.',
      };
    case 'denied':
      return {
        tone: 'warning',
        title: '위치 권한이 없어 거리를 측정하지 않아요',
        body: '코칭 음성과 시간 기록은 그대로 진행돼요. 거리와 페이스만 빠져요.',
        action: '기기 설정 > 러닝봄 > 위치에서 "앱을 사용하는 동안 허용"을 켜면 다음 러닝부터 측정돼요.',
      };
    case 'services-off':
      return {
        tone: 'warning',
        title: '기기 위치 서비스가 꺼져 있어요',
        body: '위치 서비스가 꺼져 있으면 거리를 측정할 수 없어요. 코칭은 계속돼요.',
        action: '기기 설정에서 위치(GPS)를 켠 뒤 러닝을 다시 시작해 주세요.',
      };
    case 'granted':
      break;
  }

  if (input.signal === 'searching') {
    return {
      tone: 'info',
      title: 'GPS 신호를 찾고 있어요',
      body: '아직 위성을 못 잡아 거리가 0.00km에 멈춰 보일 수 있어요.',
      action: '건물 사이나 지하에서는 하늘이 트인 곳으로 나오면 빨라져요.',
    };
  }
  if (input.signal === 'weak') {
    return {
      tone: 'warning',
      title: 'GPS 신호가 약해요',
      body: '신호가 약하면 거리가 실제보다 적게 쌓일 수 있어요.',
      action: '가능하면 하늘이 트인 길로 달려 주세요.',
    };
  }
  return undefined;
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
