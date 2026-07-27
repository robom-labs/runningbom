// 알림·위치·배터리 상태를 한곳에서 읽고 바꾸는 훅입니다.
// 온보딩 화면과 설정 화면이 같은 규칙을 쓰도록 여기로 모았습니다.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import {
  checkNotificationPermission,
  requestNotificationPermission,
} from './notificationPermission';
import {
  checkLocationPermission,
  locationStepSupported,
  requestLocationPermission,
} from './locationPermission';
import {
  emptyPermissionLedger,
  mergeProbeIntoRecord,
  nextPermissionAction,
  recordPermissionOutcome,
} from './rules';
import { loadPermissionLedger, savePermissionLedger } from './storage';
import {
  batteryStepSupported,
  openAppSettings,
  openBatteryOptimizationSettings,
  type SettingsOpenResult,
} from './systemSettings';
import type {
  PermissionAction,
  PermissionKey,
  PermissionLedger,
  PermissionOutcome,
} from './types';

export type PermissionSupport = Record<PermissionKey, boolean>;

export type PermissionAskResult = {
  action: PermissionAction;
  /** 시스템 창을 띄웠을 때 사용자가 고른 결과입니다. */
  outcome?: PermissionOutcome;
  /** 설정 화면을 열었을 때만 채워집니다. */
  opened?: SettingsOpenResult | 'app-settings-failed' | 'app-settings';
};

export type PermissionLedgerControls = {
  ready: boolean;
  ledger: PermissionLedger;
  supported: PermissionSupport;
  actionFor: (key: PermissionKey) => PermissionAction;
  /** 사전 설명 화면의 주 버튼입니다. 상태에 따라 시스템 창 또는 설정 화면으로 갑니다. */
  ask: (key: PermissionKey) => Promise<PermissionAskResult>;
  /** "나중에"입니다. 시스템 창을 아예 띄우지 않고 미룬 것으로만 적습니다. */
  postpone: (key: PermissionKey) => Promise<void>;
  /** 설정에서 돌아왔을 때처럼 지금 상태를 다시 확인합니다. */
  refresh: () => Promise<void>;
};

/** 이 빌드에서 어떤 단계를 보여 줄 수 있는지입니다. */
export function currentPermissionSupport(): PermissionSupport {
  return {
    notification: true,
    location: locationStepSupported(),
    battery: batteryStepSupported(),
  };
}

export function usePermissionLedger(): PermissionLedgerControls {
  const [ledger, setLedger] = useState<PermissionLedger>(emptyPermissionLedger);
  const [ready, setReady] = useState(false);
  const ledgerRef = useRef<PermissionLedger>(emptyPermissionLedger);
  const mounted = useRef(true);
  const supported = useMemo(currentPermissionSupport, []);

  const commit = useCallback((next: PermissionLedger) => {
    ledgerRef.current = next;
    if (mounted.current) setLedger(next);
    void savePermissionLedger(next);
  }, []);

  const refresh = useCallback(async () => {
    const stored = ledgerRef.current;
    const [notification, location] = await Promise.all([
      checkNotificationPermission(),
      checkLocationPermission(),
    ]);
    const next: PermissionLedger = {
      ...stored,
      notification: mergeProbeIntoRecord(stored.notification, notification),
      location: mergeProbeIntoRecord(stored.location, location),
      battery: supported.battery
        ? stored.battery
        : { outcome: 'unavailable', refusedCount: 0 },
    };
    commit(next);
  }, [commit, supported.battery]);

  useEffect(() => {
    mounted.current = true;
    void (async () => {
      const stored = await loadPermissionLedger();
      ledgerRef.current = stored;
      if (mounted.current) setLedger(stored);
      await refresh();
      if (mounted.current) setReady(true);
    })();
    return () => {
      mounted.current = false;
    };
    // refresh는 참조가 고정돼 있어 첫 실행에서 한 번만 돕니다.
  }, [refresh]);

  // 설정 화면에 갔다가 돌아오면 바뀐 값을 바로 반영합니다.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const actionFor = useCallback(
    (key: PermissionKey): PermissionAction =>
      nextPermissionAction(key, ledger[key] ?? emptyPermissionLedger[key], supported[key]),
    [ledger, supported],
  );

  const ask = useCallback(
    async (key: PermissionKey): Promise<PermissionAskResult> => {
      const current = ledgerRef.current;
      const action = nextPermissionAction(key, current[key], supported[key]);

      if (action === 'ask') {
        const probe =
          key === 'notification'
            ? await requestNotificationPermission()
            : await requestLocationPermission();
        commit(
          recordPermissionOutcome(current, key, {
            outcome: probe.outcome,
            ...(typeof probe.canAskAgain === 'boolean' ? { canAskAgain: probe.canAskAgain } : {}),
          }),
        );
        return { action, outcome: probe.outcome };
      }

      if (action === 'open-battery-settings') {
        const opened = await openBatteryOptimizationSettings();
        commit(recordPermissionOutcome(current, key, { outcome: 'opened' }));
        return { action, outcome: 'opened', opened };
      }

      if (action === 'open-app-settings') {
        const opened = await openAppSettings();
        return { action, opened: opened ? 'app-settings' : 'app-settings-failed' };
      }

      return { action };
    },
    [commit, supported],
  );

  const postpone = useCallback(
    async (key: PermissionKey) => {
      const current = ledgerRef.current;
      if (current[key].outcome === 'granted') return;
      commit(recordPermissionOutcome(current, key, { outcome: 'later' }));
    },
    [commit],
  );

  return { ready, ledger, supported, actionFor, ask, postpone, refresh };
}
