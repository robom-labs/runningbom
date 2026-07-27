// 알림·위치·배터리 세 가지 "휴대폰 허락"의 상태를 담는 순수 타입입니다.
// 화면도 저장소도 모르기 때문에 그대로 테스트할 수 있습니다.

/** 러닝봄이 물어보는 세 가지입니다. 이 목록 밖의 것은 묻지 않습니다. */
export type PermissionKey = 'notification' | 'location' | 'battery';

export const permissionKeys: PermissionKey[] = ['notification', 'location', 'battery'];

/**
 * 하나의 허락이 지금 어떤 상태인지입니다.
 * - unknown: 아직 물어본 적이 없어요
 * - granted: 켜졌어요
 * - denied: 사용자가 "안 할래요"를 골랐어요
 * - later: "나중에"를 눌러 미뤘어요(시스템 창을 아예 띄우지 않았습니다)
 * - opened: 시스템 설정 화면까지 열어 줬지만, 실제로 바꿨는지는 앱이 알 수 없어요(배터리)
 * - unavailable: 이 빌드나 이 기기에는 아예 해당하지 않아요
 */
export type PermissionOutcome =
  | 'unknown'
  | 'granted'
  | 'denied'
  | 'later'
  | 'opened'
  | 'unavailable';

export type PermissionRecord = {
  outcome: PermissionOutcome;
  /** 시스템 창에서 "안 할래요"를 고른 횟수입니다. 2번이면 더 띄우지 않습니다. */
  refusedCount: number;
  /** 시스템이 창을 한 번 더 띄워 줄 수 있는지입니다. false면 설정 화면으로 보냅니다. */
  canAskAgain?: boolean;
  /** 마지막으로 상태를 확인한 시각(ISO)입니다. */
  checkedAt?: string;
};

export type PermissionLedger = Record<PermissionKey, PermissionRecord>;

/**
 * 다음에 이 허락을 눌렀을 때 무엇을 해야 하는지입니다.
 * - ask: 사전 설명을 보여 준 뒤 시스템 창을 띄웁니다
 * - open-app-settings: 시스템 창이 더 안 뜨므로 앱 설정 화면을 엽니다
 * - open-battery-settings: 배터리는 시스템 창이 없어서 설정 화면으로만 안내합니다
 * - done: 이미 켜져 있어 더 할 일이 없습니다
 * - unavailable: 이 빌드에서는 아예 다루지 않습니다
 */
export type PermissionAction =
  | 'ask'
  | 'open-app-settings'
  | 'open-battery-settings'
  | 'done'
  | 'unavailable';
