// 러닝봄 Android foreground 코칭 서비스를 Expo 앱에 연결합니다.
import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { NativeCoachState } from './RunningbomCoach.types';

declare class RunningbomCoachModule extends NativeModule {
  isAvailable(): boolean;
  startSession(
    sessionId: string,
    definitionId: string,
    title: string,
    countsAs: 'run' | 'walk' | 'recovery',
    durationSeconds: number,
    cueSchedule: string,
    speechRate: number,
  ): Promise<void>;
  pauseSession(): Promise<void>;
  resumeSession(): Promise<void>;
  stopSession(): Promise<void>;
  getState(): Promise<NativeCoachState>;
}

const unavailableModule = {
  isAvailable: () => false,
  startSession: async () => undefined,
  pauseSession: async () => undefined,
  resumeSession: async () => undefined,
  stopSession: async () => undefined,
  getState: async (): Promise<NativeCoachState> => ({
    state: 'idle',
    elapsedSeconds: 0,
    durationSeconds: 0,
  }),
} as unknown as RunningbomCoachModule;

export default requireOptionalNativeModule<RunningbomCoachModule>('RunningbomCoach') ?? unavailableModule;
