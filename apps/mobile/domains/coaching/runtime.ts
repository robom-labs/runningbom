// 네이티브 코칭 완료 상태를 중복 없는 로컬 활동 기록으로 정규화합니다.
import type { ActivityKind } from '../activities/types';

export type RestorableCoachCompletion = {
  sessionId?: string;
  countsAs?: ActivityKind;
  durationSeconds: number;
  completedAtEpochMillis?: number;
};

export function coachActivityId(sessionId: string): string {
  return `coach:${sessionId}`;
}

export function coachCompletionRecord(
  runtime: RestorableCoachCompletion,
): {
  id: string;
  kind: ActivityKind;
  durationMinutes: number;
  completedAt?: string;
} | null {
  if (!runtime.sessionId || !runtime.countsAs || runtime.durationSeconds <= 0) {
    return null;
  }

  return {
    id: coachActivityId(runtime.sessionId),
    kind: runtime.countsAs,
    durationMinutes: Math.max(1, Math.round(runtime.durationSeconds / 60)),
    ...(runtime.completedAtEpochMillis && runtime.completedAtEpochMillis > 0
      ? { completedAt: new Date(runtime.completedAtEpochMillis).toISOString() }
      : {}),
  };
}
