// Android 네이티브 foreground 코치와 iOS의 안전한 화면·음성 fallback을 하나로 감쌉니다.
import * as Speech from 'expo-speech';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

import RunningbomCoachModule from '../../modules/runningbom-coach/src/RunningbomCoachModule';
import type { ActivityKind } from '../../domains/activities/types';
import type { CoachSession } from '../../domains/coaching/model';
import { cueScheduleForNative } from '../../domains/coaching/model';
import {
  idleFallbackClock,
  pauseFallbackClock,
  resumeFallbackClock,
  snapshotFallbackClock,
  startFallbackClock,
  stopFallbackClock,
  type FallbackCoachClock,
} from '../../domains/coaching/fallbackClock';

export type CoachRuntimeState = {
  state: 'idle' | 'running' | 'paused' | 'completed' | 'stopped';
  sessionId?: string;
  definitionId?: string;
  title?: string;
  countsAs?: ActivityKind;
  elapsedSeconds: number;
  durationSeconds: number;
  startedAtEpochMillis?: number;
  completedAtEpochMillis?: number;
  native: boolean;
};

let fallbackState: FallbackCoachClock = idleFallbackClock;
let fallbackInUse = false;
let fallbackSession: CoachSession | undefined;
let fallbackCueIndex = 0;
let fallbackCueTimer: ReturnType<typeof setTimeout> | undefined;
let fallbackSpeechRate = 1;

function clearFallbackCueTimer() {
  if (fallbackCueTimer) clearTimeout(fallbackCueTimer);
  fallbackCueTimer = undefined;
}

function scheduleFallbackCuePump() {
  clearFallbackCueTimer();
  const pump = () => {
    fallbackState = snapshotFallbackClock(fallbackState, Date.now());
    if (!fallbackSession || fallbackState.state !== 'running') return;
    let dueIndex = -1;
    while (
      fallbackCueIndex < fallbackSession.cues.length &&
      fallbackSession.cues[fallbackCueIndex].offsetSeconds <= fallbackState.elapsedSeconds
    ) {
      dueIndex = fallbackCueIndex;
      fallbackCueIndex += 1;
    }
    if (dueIndex >= 0) {
      const cue = fallbackSession.cues[dueIndex];
      Speech.stop();
      Speech.speak(cue.text, { language: 'ko-KR', rate: fallbackSpeechRate });
    }
    fallbackCueTimer = setTimeout(pump, 750);
  };
  pump();
}

function runtimeFromFallback(clock: FallbackCoachClock): CoachRuntimeState {
  return {
    state: clock.state,
    ...(clock.sessionId ? { sessionId: clock.sessionId } : {}),
    ...(clock.definitionId ? { definitionId: clock.definitionId } : {}),
    ...(clock.title ? { title: clock.title } : {}),
    ...(clock.countsAs ? { countsAs: clock.countsAs } : {}),
    elapsedSeconds: clock.elapsedSeconds,
    durationSeconds: clock.durationSeconds,
    ...(clock.startedAtEpochMillis
      ? { startedAtEpochMillis: clock.startedAtEpochMillis }
      : {}),
    ...(clock.completedAtEpochMillis
      ? { completedAtEpochMillis: clock.completedAtEpochMillis }
      : {}),
    native: false,
  };
}

export function nativeCoachAvailable(): boolean {
  return Platform.OS === 'android' && RunningbomCoachModule.isAvailable();
}

export async function startCoachSession(
  session: CoachSession,
  speechRate = 1,
): Promise<CoachRuntimeState> {
  const sessionId = Crypto.randomUUID();
  const startedAtEpochMillis = Date.now();

  if (nativeCoachAvailable()) {
    try {
      await RunningbomCoachModule.startSession(
        sessionId,
        session.id,
        session.title,
        session.countsAs,
        session.durationMinutes * 60,
        cueScheduleForNative(session),
        speechRate,
      );
      fallbackInUse = false;
      fallbackState = idleFallbackClock;
      fallbackSession = undefined;
      clearFallbackCueTimer();
      return getCoachState();
    } catch {
      fallbackInUse = true;
    }
  } else {
    fallbackInUse = true;
  }

  Speech.stop();
  fallbackState = startFallbackClock({
    sessionId,
    definitionId: session.id,
    title: session.title,
    countsAs: session.countsAs,
    durationSeconds: session.durationMinutes * 60,
  }, startedAtEpochMillis);
  fallbackSession = session;
  fallbackCueIndex = 0;
  fallbackSpeechRate = Math.min(1.1, Math.max(0.8, speechRate));
  scheduleFallbackCuePump();
  return runtimeFromFallback(fallbackState);
}

export async function pauseCoachSession(): Promise<CoachRuntimeState> {
  if (nativeCoachAvailable() && !fallbackInUse) {
    await RunningbomCoachModule.pauseSession();
    return getCoachState();
  }
  Speech.stop();
  clearFallbackCueTimer();
  fallbackState = pauseFallbackClock(fallbackState, Date.now());
  return runtimeFromFallback(fallbackState);
}

export async function resumeCoachSession(): Promise<CoachRuntimeState> {
  if (nativeCoachAvailable() && !fallbackInUse) {
    await RunningbomCoachModule.resumeSession();
    return getCoachState();
  }
  fallbackState = resumeFallbackClock(fallbackState, Date.now());
  scheduleFallbackCuePump();
  return runtimeFromFallback(fallbackState);
}

export async function stopCoachSession(): Promise<CoachRuntimeState> {
  if (nativeCoachAvailable() && !fallbackInUse) {
    await RunningbomCoachModule.stopSession();
    return getCoachState();
  }
  Speech.stop();
  clearFallbackCueTimer();
  fallbackSession = undefined;
  fallbackState = stopFallbackClock(fallbackState, Date.now());
  return runtimeFromFallback(fallbackState);
}

export async function getCoachState(): Promise<CoachRuntimeState> {
  if (!nativeCoachAvailable() || fallbackInUse) {
    fallbackState = snapshotFallbackClock(fallbackState, Date.now());
    return runtimeFromFallback(fallbackState);
  }
  const value = await RunningbomCoachModule.getState();
  return {
    state: value.state,
    ...(value.sessionId ? { sessionId: value.sessionId } : {}),
    ...(value.definitionId ? { definitionId: value.definitionId } : {}),
    ...(value.title ? { title: value.title } : {}),
    ...(value.countsAs ? { countsAs: value.countsAs } : {}),
    elapsedSeconds: value.elapsedSeconds,
    durationSeconds: value.durationSeconds,
    ...(value.startedAtEpochMillis
      ? { startedAtEpochMillis: value.startedAtEpochMillis }
      : {}),
    ...(value.completedAtEpochMillis
      ? { completedAtEpochMillis: value.completedAtEpochMillis }
      : {}),
    native: true,
  };
}
