// 휴대폰 설정 화면을 여는 얇은 껍데기입니다.
//
// 배터리 아끼기 제외는 새 권한을 선언하지 않습니다.
// REQUEST_IGNORE_BATTERY_OPTIMIZATIONS는 Play 정책상 위험해서 절대 쓰지 않고,
// 권한 없이도 열리는 시스템 설정 목록으로만 안내합니다.
import { Linking, Platform } from 'react-native';

/** 권한 선언 없이 열 수 있는 배터리 설정 목록입니다. */
export const BATTERY_SETTINGS_INTENT = 'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS';

export type SettingsOpenResult =
  /** 배터리 목록이 그대로 열렸습니다. */
  | 'battery-list'
  /** 목록을 못 열어 러닝봄 앱 설정으로 대신 열었습니다. */
  | 'app-settings'
  /** 둘 다 실패했습니다. 화면에서 직접 찾아 달라고 안내합니다. */
  | 'failed'
  /** 안드로이드가 아니라 해당 없음입니다. */
  | 'unsupported';

/** 배터리 단계를 보여 줄 기기인지입니다. iOS에는 같은 설정이 없어 단계를 넣지 않습니다. */
export function batteryStepSupported(platform: string = Platform.OS): boolean {
  return platform === 'android';
}

/** 러닝봄 앱 설정 화면을 엽니다. 두 번 거절해 시스템 창이 안 뜰 때 씁니다. */
export async function openAppSettings(): Promise<boolean> {
  try {
    await Linking.openSettings();
    return true;
  } catch {
    return false;
  }
}

/**
 * 배터리 아끼기 제외 목록을 엽니다.
 * 인텐트가 없는 기기(제조사별로 다릅니다)에서는 러닝봄 앱 설정으로 폴백합니다.
 */
export async function openBatteryOptimizationSettings(): Promise<SettingsOpenResult> {
  if (!batteryStepSupported()) return 'unsupported';
  try {
    await Linking.sendIntent(BATTERY_SETTINGS_INTENT);
    return 'battery-list';
  } catch {
    return (await openAppSettings()) ? 'app-settings' : 'failed';
  }
}
