// Android foreground 코칭 서비스가 JavaScript에 노출하는 상태 계약을 정의합니다.
export type NativeCoachState = {
  state: 'idle' | 'running' | 'paused' | 'completed' | 'stopped';
  sessionId?: string;
  definitionId?: string;
  title?: string;
  countsAs?: 'run' | 'walk' | 'recovery';
  elapsedSeconds: number;
  durationSeconds: number;
  openEnded?: boolean;
  startedAtEpochMillis?: number;
  completedAtEpochMillis?: number;
};

export type NativeMetronomeState = {
  playing: boolean;
  cadence: number;
  beatCount: number;
  startedAtEpochMillis?: number;
  underrunCount?: number;
};
