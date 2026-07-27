// 알림 허락을 확인하고 요청합니다. 실패해도 앱이 멈추지 않도록 모두 조용히 처리합니다.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { PermissionOutcome } from './types';

export type PermissionProbe = {
  outcome: PermissionOutcome;
  canAskAgain?: boolean;
};

function allowsNotifications(status: Notifications.NotificationPermissionsStatus): boolean {
  if (Platform.OS !== 'ios') return status.granted;
  const iosStatus = status.ios?.status;
  return (
    status.granted ||
    iosStatus === Notifications.IosAuthorizationStatus.AUTHORIZED ||
    iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL
  );
}

function toProbe(status: Notifications.NotificationPermissionsStatus): PermissionProbe {
  if (allowsNotifications(status)) return { outcome: 'granted', canAskAgain: false };
  return { outcome: 'denied', canAskAgain: status.canAskAgain !== false };
}

/** 지금 상태만 확인합니다. 시스템 창을 띄우지 않습니다. */
export async function checkNotificationPermission(): Promise<PermissionProbe> {
  try {
    const status = await Notifications.getPermissionsAsync();
    if (allowsNotifications(status)) return { outcome: 'granted', canAskAgain: false };
    // 아직 한 번도 안 물어본 상태를 "거절"로 적지 않도록 undetermined를 구분합니다.
    if (status.status === 'undetermined') {
      return { outcome: 'unknown', canAskAgain: true };
    }
    return { outcome: 'denied', canAskAgain: status.canAskAgain !== false };
  } catch {
    return { outcome: 'unknown' };
  }
}

/** 사전 설명 화면 다음에만 호출합니다. 여기서 시스템 창이 뜹니다. */
export async function requestNotificationPermission(): Promise<PermissionProbe> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (allowsNotifications(current)) return { outcome: 'granted', canAskAgain: false };
    const requested = await Notifications.requestPermissionsAsync();
    return toProbe(requested);
  } catch {
    return { outcome: 'unknown' };
  }
}
