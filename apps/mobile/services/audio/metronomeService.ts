// Android 네이티브 AudioTrack 메트로놈과 비지원 플랫폼의 안전한 상태를 연결합니다.
import { Platform } from 'react-native';

import RunningbomCoachModule from '../../modules/runningbom-coach/src/RunningbomCoachModule';
import type { NativeMetronomeState } from '../../modules/runningbom-coach/src/RunningbomCoach.types';
import { clampCadence } from '../../domains/cadence/metronome';

const idleState: NativeMetronomeState = {
  playing: false,
  cadence: 170,
  beatCount: 0,
  underrunCount: 0,
};

export function nativeMetronomeAvailable(): boolean {
  return (Platform.OS === 'android' || Platform.OS === 'ios')
    && RunningbomCoachModule.isAvailable();
}

export async function startNativeMetronome(cadence: number): Promise<NativeMetronomeState> {
  if (!nativeMetronomeAvailable()) return idleState;
  await RunningbomCoachModule.startMetronome(clampCadence(cadence));
  return RunningbomCoachModule.getMetronomeState();
}

export async function stopNativeMetronome(): Promise<NativeMetronomeState> {
  if (!nativeMetronomeAvailable()) return idleState;
  await RunningbomCoachModule.stopMetronome();
  return {
    ...(await RunningbomCoachModule.getMetronomeState()),
    playing: false,
  };
}

export async function getNativeMetronomeState(): Promise<NativeMetronomeState> {
  if (!nativeMetronomeAvailable()) return idleState;
  return RunningbomCoachModule.getMetronomeState();
}
