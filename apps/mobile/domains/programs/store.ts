// 프로그램 진행 상태를 이 기기에 저장하는 값의 모양입니다. 저장·읽기는 usePrograms가 합니다.
// 새 키만 쓰고 기존 키(활동·설정·목표 대회·도전)는 건드리지 않습니다.
import type { SessionAttempt } from './progress';

export const PROGRAM_STORE_KEY = 'runningbom:vnext:programs:v1';

/** 최근 기록은 이만큼만 남깁니다. 저장 값이 끝없이 커지지 않게 하려고요. */
export const MAX_ATTEMPTS = 60;

export type ProgramStore = {
  /** 완료로 표시한 회차 id입니다. */
  completedSessionIds: string[];
  /** 회차를 마친 기록입니다(완료로 표시하지 않은 것도 남습니다). */
  attempts: SessionAttempt[];
  /** 프로그램을 처음 시작한 시각입니다. */
  startedAt?: string;
};

export const emptyProgramStore: ProgramStore = {
  completedSessionIds: [],
  attempts: [],
};

function isAttempt(value: unknown): value is SessionAttempt {
  if (!value || typeof value !== 'object') return false;
  const attempt = value as Partial<SessionAttempt>;
  return (
    typeof attempt.sessionId === 'string' &&
    typeof attempt.finishedAt === 'string' &&
    typeof attempt.completedSeconds === 'number' &&
    Number.isFinite(attempt.completedSeconds) &&
    attempt.completedSeconds >= 0 &&
    typeof attempt.totalSeconds === 'number' &&
    Number.isFinite(attempt.totalSeconds) &&
    attempt.totalSeconds > 0
  );
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((item): item is string => typeof item === 'string')));
}

/** 저장 값이 깨져 있어도 앱이 멈추지 않도록 쓸 수 있는 부분만 살립니다. */
export function parseProgramStore(value: unknown): ProgramStore {
  if (!value || typeof value !== 'object') return emptyProgramStore;
  const store = value as Partial<ProgramStore>;
  const attempts = Array.isArray(store.attempts)
    ? store.attempts.filter(isAttempt).slice(-MAX_ATTEMPTS)
    : [];
  return {
    completedSessionIds: stringList(store.completedSessionIds),
    attempts,
    ...(typeof store.startedAt === 'string' ? { startedAt: store.startedAt } : {}),
  };
}

/**
 * 회차를 마친 기록을 남깁니다.
 * markComplete가 true일 때만 완료 목록에 넣습니다(한 번 더 하기를 고르면 기록만 남아요).
 */
export function saveAttempt(
  store: ProgramStore,
  attempt: SessionAttempt,
  markComplete: boolean,
): ProgramStore {
  const attempts = [...store.attempts, attempt].slice(-MAX_ATTEMPTS);
  const completedSessionIds =
    markComplete && !store.completedSessionIds.includes(attempt.sessionId)
      ? [...store.completedSessionIds, attempt.sessionId]
      : store.completedSessionIds;
  return {
    completedSessionIds,
    attempts,
    startedAt: store.startedAt ?? attempt.finishedAt,
  };
}

/** 처음부터 다시 하기입니다. 지난 기록은 남겨 둡니다. */
export function restartProgram(store: ProgramStore): ProgramStore {
  return { ...store, completedSessionIds: [] };
}

/** 같은 회차를 여러 번 했을 때 가장 잘한 완주율을 찾습니다. */
export function bestAttempt(store: ProgramStore, sessionId: string): SessionAttempt | undefined {
  return store.attempts
    .filter((attempt) => attempt.sessionId === sessionId)
    .sort(
      (left, right) =>
        right.completedSeconds / right.totalSeconds - left.completedSeconds / left.totalSeconds,
    )[0];
}
