// 위치 허락은 Preview 빌드에서만 묻습니다.
// 정식 빌드는 app.config.js가 위치를 아예 차단하므로, 판정은 domains/tracking/availability.ts와 같은 방식을 씁니다.
import * as Location from 'expo-location';

import { gpsTrackingEnabled } from '../../domains/tracking/availability';
import type { PermissionProbe } from './notificationPermission';

/** 이 빌드에서 위치를 물어봐도 되는지입니다. Preview에서만 true입니다. */
export function locationStepSupported(): boolean {
  return gpsTrackingEnabled();
}

/** 지금 상태만 확인합니다. 시스템 창을 띄우지 않습니다. */
export async function checkLocationPermission(): Promise<PermissionProbe> {
  if (!locationStepSupported()) return { outcome: 'unavailable' };
  try {
    const status = await Location.getForegroundPermissionsAsync();
    if (status.granted) return { outcome: 'granted', canAskAgain: false };
    if (status.status === 'undetermined') return { outcome: 'unknown', canAskAgain: true };
    return { outcome: 'denied', canAskAgain: status.canAskAgain !== false };
  } catch {
    return { outcome: 'unknown' };
  }
}

/**
 * 사전 설명 화면 다음에만 호출합니다.
 * 앱을 쓰는 동안의 위치만 요청하고, 앱을 끈 사이의 위치는 어떤 경우에도 요청하지 않습니다.
 */
export async function requestLocationPermission(): Promise<PermissionProbe> {
  if (!locationStepSupported()) return { outcome: 'unavailable' };
  try {
    const current = await Location.getForegroundPermissionsAsync();
    if (current.granted) return { outcome: 'granted', canAskAgain: false };
    const requested = await Location.requestForegroundPermissionsAsync();
    if (requested.granted) return { outcome: 'granted', canAskAgain: false };
    return { outcome: 'denied', canAskAgain: requested.canAskAgain !== false };
  } catch {
    return { outcome: 'unknown' };
  }
}
