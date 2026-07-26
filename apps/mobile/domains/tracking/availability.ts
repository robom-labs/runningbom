// GPS 추적을 이 빌드에서 켜도 되는지(Preview 전용) 판단합니다.
import Constants from 'expo-constants';

/**
 * 정식 앱은 위치 권한을 blockedPermissions로 차단해 두므로 GPS 기능을 노출하지 않습니다.
 * app.config.js가 넣어 주는 extra.preview.enabled만 신뢰합니다.
 */
export function gpsTrackingEnabled(): boolean {
  return Constants.expoConfig?.extra?.preview?.enabled === true;
}

export const gpsUnavailableNotice =
  'GPS 거리 측정은 Preview 빌드에서만 제공해요. 이 빌드에서는 시간 기반 코칭만 진행해요.';
