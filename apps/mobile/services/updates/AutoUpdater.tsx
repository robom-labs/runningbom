// 새 내용을 앱이 스스로 받아서 스스로 적용합니다. 사용자는 아무것도 누르지 않습니다.
//
// 언제 적용하나:
//   - **앱을 켠 직후 새 내용을 받으면 바로 적용합니다.** 기다리게 하지 않습니다.
//     expo-updates 기본 동작은 "이번에 받아 두고 다음에 켤 때 적용"이라,
//     껐다 켜도 그 회차에는 여전히 옛날 내용이 돌고 한 번 더 껐다 켜야 새 내용이 나옵니다.
//     사용자에게는 "업데이트를 안 하는 앱"으로 보입니다.
//   - 켠 지 오래됐으면 앱을 다시 열었을 때(잠깐 다른 앱 보다가 돌아온 순간) 적용합니다.
//     한창 쓰는 중에 화면이 튀면 하던 일이 끊기기 때문입니다.
//
// 언제 미루나:
//   - **달리는 중에는 절대 적용하지 않습니다.** 적용은 앱을 다시 시작하는 일이라,
//     달리는 도중에 하면 그날 기록이 통째로 사라집니다. 다 뛰고 난 뒤로 미룹니다.
//
// 화면에 아무것도 그리지 않습니다. 정식 앱·개발 서버처럼 자동 업데이트가 꺼진
// 빌드에서는 그냥 아무 일도 하지 않습니다. 어떤 경우에도 예외를 밖으로 던지지 않습니다.
import * as Updates from 'expo-updates';
import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { isRunInProgress } from './runInProgress';

export function AutoUpdater() {
  /** 받아 뒀지만 아직 적용하지 못한 새 내용이 있는지. */
  const pendingRef = useRef(false);
  /** 적용을 시작했는지. 두 번 겹쳐 부르지 않으려고 둡니다. */
  const applyingRef = useRef(false);

  /** 지금 적용해도 되는 때인지 보고, 괜찮으면 적용합니다. */
  const applyIfSafe = useCallback(async () => {
    if (!pendingRef.current || applyingRef.current) return;
    // 달리는 중이면 기록이 날아가므로 절대 건드리지 않습니다.
    if (isRunInProgress()) return;
    applyingRef.current = true;
    try {
      await Updates.reloadAsync();
    } catch {
      // 다시 시작하지 못해도 다음에 앱을 껐다 켜면 자동으로 적용됩니다.
      applyingRef.current = false;
    }
  }, []);

  /** 앱이 켜진 시각입니다. 켠 직후에는 바로 적용해도 하던 일을 끊지 않습니다. */
  const openedAtRef = useRef(Date.now());

  /**
   * 켠 직후 이 시간 안에 새 내용을 받으면 **기다리지 않고 바로 적용**합니다.
   *
   * 왜 필요한가:
   *   expo-updates는 기본적으로 "이번에 받아 두고 다음에 켤 때 적용"합니다.
   *   그래서 사용자가 앱을 껐다 켜도 그 회차에는 여전히 옛날 내용이 돌고,
   *   한 번 더 껐다 켜야 새 내용이 나옵니다.
   *   회장 보고: "다시 껐다 켜도 업그레이드 같은 걸 안 해. 이게 맞는 건가."
   *   맞지 않습니다. 켠 직후라면 바로 적용하는 편이 훨씬 덜 헷갈립니다.
   */
  const APPLY_IMMEDIATELY_WITHIN_MILLIS = 60_000;

  /** 새 내용이 있으면 받습니다. 켠 직후라면 바로 적용까지 합니다. */
  const fetchQuietly = useCallback(async () => {
    if (!Updates.isEnabled || pendingRef.current) return;
    try {
      const check = await Updates.checkForUpdateAsync();
      if (!check.isAvailable) return;
      const fetched = await Updates.fetchUpdateAsync();
      if (!fetched.isNew) return;
      pendingRef.current = true;

      // 켠 지 얼마 안 됐고 달리는 중이 아니면 지금 적용합니다.
      // 한 번 더 껐다 켜라고 하지 않기 위해서입니다.
      const openedRecently =
        Date.now() - openedAtRef.current <= APPLY_IMMEDIATELY_WITHIN_MILLIS;
      if (openedRecently) await applyIfSafe();
    } catch {
      // 인터넷이 없거나 서버가 조용하면 넘어갑니다. 다음에 다시 확인합니다.
    }
  }, [applyIfSafe]);

  useEffect(() => {
    if (!Updates.isEnabled) return;

    void fetchQuietly();

    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next !== 'active') return;
      // 돌아온 김에 적용하고, 적용할 게 없으면 새로 있는지만 받아 둡니다.
      void applyIfSafe();
      void fetchQuietly();
    });

    return () => subscription.remove();
  }, [applyIfSafe, fetchQuietly]);

  return null;
}
