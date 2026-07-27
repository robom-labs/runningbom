// 허락을 "다시 물어볼지, 설정 화면으로 보낼지"를 정하는 순수 규칙입니다.
// 안드로이드는 두 번 거절하면 시스템 창이 아예 안 뜨기 때문에, 그 뒤로는 설정 화면으로 보냅니다.
import {
  permissionKeys,
  type PermissionAction,
  type PermissionKey,
  type PermissionLedger,
  type PermissionOutcome,
  type PermissionRecord,
} from './types';

/** 새 저장 키입니다. 기존 키는 건드리지 않습니다. */
export const PERMISSION_LEDGER_KEY = 'runningbom:vnext:permission-ledger:v1';

/** 이 횟수만큼 거절하면 시스템 창을 더 띄우지 않고 설정 화면으로 보냅니다. */
export const MAX_SYSTEM_ASKS = 2;

export const emptyPermissionRecord: PermissionRecord = { outcome: 'unknown', refusedCount: 0 };

export const emptyPermissionLedger: PermissionLedger = {
  notification: emptyPermissionRecord,
  location: emptyPermissionRecord,
  battery: emptyPermissionRecord,
};

const outcomes: PermissionOutcome[] = [
  'unknown',
  'granted',
  'denied',
  'later',
  'opened',
  'unavailable',
];

function parseRecord(value: unknown): PermissionRecord {
  if (!value || typeof value !== 'object') return emptyPermissionRecord;
  const record = value as Partial<PermissionRecord>;
  const outcome = outcomes.includes(record.outcome as PermissionOutcome)
    ? (record.outcome as PermissionOutcome)
    : 'unknown';
  const rawCount = Number(record.refusedCount);
  const refusedCount = Number.isFinite(rawCount) && rawCount > 0 ? Math.floor(rawCount) : 0;
  return {
    outcome,
    refusedCount: Math.min(refusedCount, 99),
    ...(typeof record.canAskAgain === 'boolean' ? { canAskAgain: record.canAskAgain } : {}),
    ...(typeof record.checkedAt === 'string' ? { checkedAt: record.checkedAt } : {}),
  };
}

/** 저장값이 깨져 있어도 앱이 멈추지 않게 "아직 안 물어봤음"으로 되돌립니다. */
export function parsePermissionLedger(value: unknown): PermissionLedger {
  if (!value || typeof value !== 'object') return emptyPermissionLedger;
  const source = value as Record<string, unknown>;
  const ledger = { ...emptyPermissionLedger };
  for (const key of permissionKeys) {
    ledger[key] = parseRecord(source[key]);
  }
  return ledger;
}

export type OutcomeUpdate = {
  outcome: PermissionOutcome;
  canAskAgain?: boolean;
  now?: string;
};

/**
 * 한 가지 허락의 결과를 장부에 적습니다.
 * 거절 횟수는 실제로 시스템 창에서 거절했을 때만 늘어납니다("나중에"는 늘리지 않습니다).
 */
export function recordPermissionOutcome(
  ledger: PermissionLedger,
  key: PermissionKey,
  update: OutcomeUpdate,
): PermissionLedger {
  const previous = ledger[key] ?? emptyPermissionRecord;
  const refusedCount =
    update.outcome === 'denied' ? previous.refusedCount + 1 : previous.refusedCount;
  const next: PermissionRecord = {
    outcome: update.outcome,
    refusedCount: update.outcome === 'granted' ? 0 : refusedCount,
    ...(typeof update.canAskAgain === 'boolean' ? { canAskAgain: update.canAskAgain } : {}),
    checkedAt: update.now ?? new Date().toISOString(),
  };
  return { ...ledger, [key]: next };
}

export type PermissionProbeResult = {
  outcome: PermissionOutcome;
  canAskAgain?: boolean;
};

/**
 * 휴대폰에 물어본 "지금 상태"를 장부에 합칩니다.
 * 새로 고침일 뿐이므로 거절 횟수는 절대 늘리지 않습니다(늘리는 곳은 recordPermissionOutcome뿐입니다).
 */
export function mergeProbeIntoRecord(
  record: PermissionRecord,
  probe: PermissionProbeResult,
  now?: string,
): PermissionRecord {
  const checkedAt = now ?? new Date().toISOString();
  if (probe.outcome === 'unavailable') {
    return { outcome: 'unavailable', refusedCount: 0, checkedAt };
  }
  if (probe.outcome === 'granted') {
    return { outcome: 'granted', refusedCount: 0, canAskAgain: false, checkedAt };
  }
  if (probe.outcome === 'denied') {
    return {
      outcome: 'denied',
      refusedCount: Math.max(record.refusedCount, 1),
      ...(typeof probe.canAskAgain === 'boolean' ? { canAskAgain: probe.canAskAgain } : {}),
      checkedAt,
    };
  }
  // 아직 한 번도 안 물어본 상태입니다. "나중에"·"설정 열어 봄" 같은 사용자의 선택은 지우지 않습니다.
  return {
    ...record,
    ...(typeof probe.canAskAgain === 'boolean' ? { canAskAgain: probe.canAskAgain } : {}),
    checkedAt,
  };
}

/** 시스템 창을 한 번 더 띄워도 되는지입니다. */
export function canShowSystemPrompt(record: PermissionRecord): boolean {
  if (record.outcome === 'granted') return false;
  if (record.canAskAgain === false) return false;
  return record.refusedCount < MAX_SYSTEM_ASKS;
}

/** 이 허락 버튼을 눌렀을 때 무엇을 할지 정합니다. */
export function nextPermissionAction(
  key: PermissionKey,
  record: PermissionRecord,
  supported: boolean,
): PermissionAction {
  if (!supported) return 'unavailable';
  if (key === 'battery') {
    // 배터리는 시스템 권한 창이 없습니다. 언제나 설정 화면으로만 안내합니다.
    return 'open-battery-settings';
  }
  if (record.outcome === 'granted') return 'done';
  return canShowSystemPrompt(record) ? 'ask' : 'open-app-settings';
}

/** 설정 화면에 그대로 쓰는 상태 꼬리표입니다. 기술 용어를 쓰지 않습니다. */
export function permissionStatusLabel(key: PermissionKey, record: PermissionRecord): string {
  if (record.outcome === 'unavailable') return '이 앱에서는 안 써요';
  if (record.outcome === 'granted') return '켜짐';
  if (record.outcome === 'opened') return '직접 확인 필요';
  if (record.outcome === 'denied') return '꺼짐';
  if (record.outcome === 'later') return '나중에로 미룸';
  return key === 'battery' ? '아직 안 열어 봤어요' : '아직 안 물어봤어요';
}

export type StatusTone = 'positive' | 'neutral' | 'warning';

export function permissionStatusTone(record: PermissionRecord): StatusTone {
  if (record.outcome === 'granted') return 'positive';
  if (record.outcome === 'denied') return 'warning';
  return 'neutral';
}

/** 설정 화면 버튼에 쓸 글자입니다. 할 일이 없으면 undefined를 돌려줍니다. */
export function permissionActionLabel(action: PermissionAction): string | undefined {
  switch (action) {
    case 'ask':
      return '켜기';
    case 'open-app-settings':
      return '설정에서 켜기';
    case 'open-battery-settings':
      return '설정 열기';
    default:
      return undefined;
  }
}

/**
 * 온보딩 마지막 화면에서 "지금 무엇이 켜졌는지" 한 줄로 알려 줄 때 씁니다.
 * 켜진 것이 하나도 없어도 부정적으로 말하지 않습니다.
 */
export function grantedPermissionKeys(
  ledger: PermissionLedger,
  supported: Record<PermissionKey, boolean>,
): PermissionKey[] {
  return permissionKeys.filter(
    (key) => supported[key] && (ledger[key]?.outcome === 'granted' || ledger[key]?.outcome === 'opened'),
  );
}
