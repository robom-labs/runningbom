// 사용자가 직접 입력한 활동을 과장 없이 검증 가능한 로컬 기록으로 변환합니다.
import type { ActivityKind } from './types';

export type ManualActivityDraft = {
  kind: ActivityKind;
  durationText: string;
  distanceText: string;
};

export type ManualActivityValue = {
  kind: ActivityKind;
  durationMinutes: number;
  distanceKm?: number;
};

export type ManualActivityParseResult =
  | { ok: true; value: ManualActivityValue; movementCounts: boolean }
  | { ok: false; message: string };

function normalizedNumber(value: string): number {
  return Number(value.trim().replace(',', '.'));
}

export function parseManualActivity(
  draft: ManualActivityDraft,
): ManualActivityParseResult {
  const durationMinutes = normalizedNumber(draft.durationText);
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 1_440) {
    return { ok: false, message: '시간은 1분부터 1,440분까지 정수로 입력해 주세요.' };
  }

  const distanceText = draft.distanceText.trim();
  let distanceKm: number | undefined;
  if (draft.kind === 'run' && distanceText) {
    distanceKm = normalizedNumber(distanceText);
    if (!Number.isFinite(distanceKm) || distanceKm <= 0 || distanceKm > 500) {
      return { ok: false, message: '거리는 0보다 크고 500km 이하로 입력해 주세요.' };
    }
    distanceKm = Math.round(distanceKm * 100) / 100;
  }

  const movementCounts =
    draft.kind === 'recovery' ? durationMinutes >= 5 : durationMinutes >= 10;

  return {
    ok: true,
    value: {
      kind: draft.kind,
      durationMinutes,
      ...(distanceKm === undefined ? {} : { distanceKm }),
    },
    movementCounts,
  };
}
