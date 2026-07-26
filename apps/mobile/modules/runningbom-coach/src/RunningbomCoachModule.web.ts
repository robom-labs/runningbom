// 웹에서는 foreground 코칭을 제공하지 않고 안전한 비지원 상태를 반환합니다.
import type { NativeCoachState } from './RunningbomCoach.types';

const idleState: NativeCoachState = {
  state: 'idle',
  elapsedSeconds: 0,
  durationSeconds: 0,
};

export default {
  isAvailable: () => false,
  startSession: async () => undefined,
  pauseSession: async () => undefined,
  resumeSession: async () => undefined,
  stopSession: async () => undefined,
  getState: async () => idleState,
};
