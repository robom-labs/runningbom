// 러닝봄 Android foreground 코칭 서비스를 Expo 앱에 연결합니다.
import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { NativeCoachState, NativeMetronomeState } from './RunningbomCoach.types';

declare class RunningbomCoachModule extends NativeModule {
  isAvailable(): boolean;
  startSession(
    sessionId: string,
    definitionId: string,
    title: string,
    countsAs: 'run' | 'walk' | 'recovery',
    durationSeconds: number,
    cueSchedule: string,
    // Expo 네이티브 함수는 인자 8개까지만 받으므로 음성 설정은 한 객체로 묶어 전달합니다.
    voice: { rate: number; voiceId: string; pitch: number; openEnded?: boolean },
  ): Promise<void>;
  pauseSession(): Promise<void>;
  resumeSession(): Promise<void>;
  stopSession(): Promise<void>;
  getState(): Promise<NativeCoachState>;
  startMetronome(cadence: number): Promise<void>;
  stopMetronome(): Promise<void>;
  getMetronomeState(): Promise<NativeMetronomeState>;
}

const unavailableModule = {
  isAvailable: () => false,
  startSession: async () => undefined,
  pauseSession: async () => undefined,
  resumeSession: async () => undefined,
  stopSession: async () => undefined,
  startMetronome: async () => undefined,
  stopMetronome: async () => undefined,
  getMetronomeState: async (): Promise<NativeMetronomeState> => ({
    playing: false,
    cadence: 170,
    beatCount: 0,
  }),
  getState: async (): Promise<NativeCoachState> => ({
    state: 'idle',
    elapsedSeconds: 0,
    durationSeconds: 0,
  }),
} as unknown as RunningbomCoachModule;

export default requireOptionalNativeModule<RunningbomCoachModule>('RunningbomCoach') ?? unavailableModule;
