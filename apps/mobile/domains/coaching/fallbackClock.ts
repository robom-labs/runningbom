// 네이티브 코치를 사용할 수 없을 때 경과 시간을 안전하게 계산하는 순수 시계입니다.
import type { ActivityKind } from '../activities/types';

export type FallbackCoachClock = {
  state: 'idle' | 'running' | 'paused' | 'completed' | 'stopped';
  sessionId?: string;
  definitionId?: string;
  title?: string;
  countsAs?: ActivityKind;
  elapsedSeconds: number;
  durationSeconds: number;
  startedAtEpochMillis?: number;
  completedAtEpochMillis?: number;
  runningSinceEpochMillis?: number;
};

type StartFallbackClockInput = {
  sessionId: string;
  definitionId: string;
  title: string;
  countsAs: ActivityKind;
  durationSeconds: number;
};

export const idleFallbackClock: FallbackCoachClock = {
  state: 'idle',
  elapsedSeconds: 0,
  durationSeconds: 0,
};

export function startFallbackClock(
  input: StartFallbackClockInput,
  nowEpochMillis: number,
): FallbackCoachClock {
  return {
    state: 'running',
    sessionId: input.sessionId,
    definitionId: input.definitionId,
    title: input.title,
    countsAs: input.countsAs,
    elapsedSeconds: 0,
    durationSeconds: Math.max(1, Math.floor(input.durationSeconds)),
    startedAtEpochMillis: nowEpochMillis,
    runningSinceEpochMillis: nowEpochMillis,
  };
}

export function snapshotFallbackClock(
  clock: FallbackCoachClock,
  nowEpochMillis: number,
): FallbackCoachClock {
  if (clock.state !== 'running' || clock.runningSinceEpochMillis === undefined) {
    return clock;
  }

  const additionalSeconds = Math.floor(
    Math.max(0, nowEpochMillis - clock.runningSinceEpochMillis) / 1_000,
  );
  const elapsedSeconds = Math.min(
    clock.durationSeconds,
    clock.elapsedSeconds + additionalSeconds,
  );

  if (elapsedSeconds >= clock.durationSeconds) {
    const remainingSeconds = Math.max(0, clock.durationSeconds - clock.elapsedSeconds);
    const { runningSinceEpochMillis, ...completedClock } = clock;
    return {
      ...completedClock,
      state: 'completed',
      elapsedSeconds: clock.durationSeconds,
      completedAtEpochMillis:
        runningSinceEpochMillis + remainingSeconds * 1_000,
    };
  }

  return {
    ...clock,
    elapsedSeconds,
    runningSinceEpochMillis: nowEpochMillis,
  };
}

export function pauseFallbackClock(
  clock: FallbackCoachClock,
  nowEpochMillis: number,
): FallbackCoachClock {
  const snapshot = snapshotFallbackClock(clock, nowEpochMillis);
  if (snapshot.state !== 'running') return snapshot;
  const { runningSinceEpochMillis: _runningSinceEpochMillis, ...pausedClock } = snapshot;
  return {
    ...pausedClock,
    state: 'paused',
  };
}

export function resumeFallbackClock(
  clock: FallbackCoachClock,
  nowEpochMillis: number,
): FallbackCoachClock {
  if (clock.state !== 'paused') return clock;
  return {
    ...clock,
    state: 'running',
    runningSinceEpochMillis: nowEpochMillis,
  };
}

export function stopFallbackClock(
  clock: FallbackCoachClock,
  nowEpochMillis: number,
): FallbackCoachClock {
  const snapshot = snapshotFallbackClock(clock, nowEpochMillis);
  if (snapshot.state === 'completed' || snapshot.state === 'idle') return snapshot;
  const { runningSinceEpochMillis: _runningSinceEpochMillis, ...stoppedClock } = snapshot;
  return {
    ...stoppedClock,
    state: 'stopped',
  };
}
