// expo-location의 포그라운드 위치 구독을 러닝봄이 쓰는 최소 형태로 감쌉니다.
// 백그라운드 위치(ACCESS_BACKGROUND_LOCATION)는 쓰지 않습니다.
import * as Location from 'expo-location';

import type { LocationFix } from './filter';
import type { TrackingPermissionState } from './session';

export type LocationSubscriptionLike = { remove: () => void };

/** 배터리를 과하게 쓰지 않으면서 러닝 페이스를 볼 수 있는 수준의 구독 설정입니다. */
export const foregroundWatchOptions = {
  accuracy: Location.Accuracy.Balanced,
  timeInterval: 3_000,
  distanceInterval: 5,
} as const;

export function toLocationFix(location: Location.LocationObject): LocationFix {
  return {
    latitudeDeg: location.coords.latitude,
    longitudeDeg: location.coords.longitude,
    ...(location.coords.accuracy === null || location.coords.accuracy === undefined
      ? {}
      : { accuracyMeters: location.coords.accuracy }),
    ...(location.coords.speed === null || location.coords.speed === undefined
      ? {}
      : { speedMetersPerSecond: location.coords.speed }),
    timestampMillis: location.timestamp,
  };
}

/**
 * 세션 시작 시 포그라운드 위치 권한을 요청합니다.
 * 거부는 오류가 아니라 'denied' 상태로 돌려주고, 호출자는 계속 진행할 수 있어야 합니다.
 */
export async function requestForegroundTracking(): Promise<TrackingPermissionState> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return 'denied';
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    return servicesEnabled ? 'granted' : 'services-off';
  } catch {
    // 권한 API 자체가 실패해도 러닝은 계속돼야 하므로 거부와 같게 다룹니다.
    return 'denied';
  }
}

/** 포그라운드 위치 구독을 시작합니다. 실패하면 undefined를 돌려주고 앱은 계속 동작합니다. */
export async function watchForegroundPosition(
  onFix: (fix: LocationFix) => void,
): Promise<LocationSubscriptionLike | undefined> {
  try {
    return await Location.watchPositionAsync(foregroundWatchOptions, (location) => {
      onFix(toLocationFix(location));
    });
  } catch {
    return undefined;
  }
}
