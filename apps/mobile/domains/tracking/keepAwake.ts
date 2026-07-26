// 러닝 중에만 화면이 꺼지지 않게 잡아 두는 얇은 래퍼입니다.
// 백그라운드 위치 권한은 쓰지 않으므로, 화면이 켜져 있는 동안만 추적이 이어집니다.
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

/** 다른 화면의 keep-awake와 섞이지 않도록 러닝 세션 전용 태그를 씁니다. */
export const RUN_KEEP_AWAKE_TAG = 'runningbom-run-session';

/** 배터리 소모가 늘 수 있다는 사실을 세션마다 한 번만 알립니다. */
export const keepAwakeNotice =
  '러닝 중에는 화면이 꺼지지 않아요. 배터리 소모가 늘 수 있어요.';

/**
 * 화면 꺼짐을 막습니다. 실패해도 러닝은 계속돼야 하므로 예외를 삼키고 false를 돌려줍니다.
 */
export async function activateRunKeepAwake(): Promise<boolean> {
  try {
    await activateKeepAwakeAsync(RUN_KEEP_AWAKE_TAG);
    return true;
  } catch {
    return false;
  }
}

/**
 * 화면 꺼짐 방지를 해제합니다.
 * 일시정지·종료·언마운트 어느 경로로 와도 반드시 호출돼야 잠금이 새지 않습니다.
 */
export function deactivateRunKeepAwake(): void {
  try {
    // 이미 해제된 태그를 다시 해제해도 안전하도록 실패는 무시합니다.
    void Promise.resolve(deactivateKeepAwake(RUN_KEEP_AWAKE_TAG)).catch(() => undefined);
  } catch {
    // no-op
  }
}
