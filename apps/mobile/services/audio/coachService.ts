// Android 네이티브 foreground 코치와 iOS의 안전한 화면·음성 fallback을 하나로 감쌉니다.
import * as Speech from 'expo-speech';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

import RunningbomCoachModule from '../../modules/runningbom-coach/src/RunningbomCoachModule';
import type { ActivityKind } from '../../domains/activities/types';
import type { CoachSession } from '../../domains/coaching/model';
import { cueScheduleForNative } from '../../domains/coaching/model';
import {
  koreanVoiceAvailability,
  rankKoreanVoices,
  selectVoiceIdentifier,
  voicePreviewText,
  voiceTuning,
  type RankedVoice,
  type SpeechVoiceLike,
  type VoiceAvailability,
  type VoiceGender,
} from '../../domains/coaching/voice';
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

export type CoachVoiceStatus = {
  availability: VoiceAvailability;
  selectedIdentifier?: string;
  candidates: RankedVoice[];
};

let fallbackState: FallbackCoachClock = idleFallbackClock;
let fallbackInUse = false;
let fallbackSession: CoachSession | undefined;
let fallbackCueIndex = 0;
let fallbackCueTimer: ReturnType<typeof setTimeout> | undefined;
let fallbackSpeechRate = 1;
let fallbackSpeechPitch = 1;
let fallbackVoiceIdentifier: string | undefined;

let cachedVoices: SpeechVoiceLike[] | undefined;

// 코치 대사 사이에 끼워 넣는 짧은 안내(자동 멈춤·지금 기록·카운트다운)가 쓸 목소리 설정입니다.
let asideSpeechRate = 1;
let asideSpeechPitch = 1;
let asideVoiceIdentifier: string | undefined;

async function availableVoices(): Promise<SpeechVoiceLike[]> {
  if (cachedVoices) return cachedVoices;
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    cachedVoices = voices.map((voice) => ({
      identifier: voice.identifier,
      name: voice.name,
      language: voice.language,
      quality: String(voice.quality ?? ''),
    }));
  } catch {
    cachedVoices = [];
  }
  return cachedVoices;
}

/** 기기 음성 목록을 다시 읽습니다(사용자가 음성을 새로 설치한 경우). */
export function resetVoiceCache(): void {
  cachedVoices = undefined;
}

export async function coachVoiceStatus(gender: VoiceGender): Promise<CoachVoiceStatus> {
  const voices = await availableVoices();
  const candidates = rankKoreanVoices(voices, gender);
  const selectedIdentifier = selectVoiceIdentifier(voices, gender);
  return {
    availability: koreanVoiceAvailability(voices),
    candidates,
    ...(selectedIdentifier ? { selectedIdentifier } : {}),
  };
}

// 발화가 겹치지 않도록 한 번에 하나씩만 말하고, 밀린 큐는 최신 것만 남깁니다.
type SpeechJob = { text: string; options: Speech.SpeechOptions };
let speechQueue: SpeechJob[] = [];
let speaking = false;

function drainSpeechQueue() {
  if (speaking) return;
  const job = speechQueue.shift();
  if (!job) return;
  speaking = true;
  const finish = () => {
    speaking = false;
    drainSpeechQueue();
  };
  Speech.speak(job.text, {
    ...job.options,
    onDone: finish,
    onStopped: finish,
    onError: finish,
  });
}

function enqueueSpeech(text: string, options: Speech.SpeechOptions) {
  speechQueue.push({ text, options });
  // 코치는 지난 이야기를 되풀이하지 않습니다. 밀린 큐는 최신 하나만 유지합니다.
  if (speechQueue.length > 1) speechQueue = speechQueue.slice(-1);
  drainSpeechQueue();
}

function clearSpeechQueue() {
  speechQueue = [];
  speaking = false;
  void Speech.stop();
}

export async function previewCoachVoice(
  gender: VoiceGender,
  speechRate = 1,
): Promise<void> {
  const voices = await availableVoices();
  const identifier = selectVoiceIdentifier(voices, gender);
  const tuning = voiceTuning('easy', gender, 'standard', speechRate);
  clearSpeechQueue();
  enqueueSpeech(voicePreviewText[gender], {
    language: 'ko-KR',
    rate: tuning.rate,
    pitch: tuning.pitch,
    ...(identifier ? { voice: identifier } : {}),
  });
}

/**
 * 카운트다운처럼 세션이 시작되기 전에 말해야 할 때 목소리를 미리 준비합니다.
 * 실패해도 기기 기본 한국어 음성으로 말하면 되므로 예외를 삼킵니다.
 */
export async function prepareCoachAsideVoice(
  gender: VoiceGender,
  speechRate = 1,
): Promise<void> {
  try {
    const voices = await availableVoices();
    const identifier = selectVoiceIdentifier(voices, gender);
    const tuning = voiceTuning('easy', gender, 'standard', speechRate);
    asideSpeechRate = tuning.rate;
    asideSpeechPitch = tuning.pitch;
    asideVoiceIdentifier = identifier;
  } catch {
    asideSpeechRate = speechRate;
  }
}

/**
 * 코치 대사와 겹치지 않게 같은 발화 큐에 짧은 안내를 넣습니다.
 * 큐는 한 번에 하나만 말하고 밀린 문장은 최신 하나만 남기므로, 안내가 겹쳐 들리지 않습니다.
 * (Android 네이티브 코치가 말하는 동안에는 그 대사와 순서를 맞출 수 없어, 아주 짧은 문장만 씁니다.)
 */
export function speakCoachAside(text: string): void {
  const trimmed = text.trim();
  if (!trimmed) return;
  enqueueSpeech(trimmed, {
    language: 'ko-KR',
    rate: asideSpeechRate,
    pitch: asideSpeechPitch,
    ...(asideVoiceIdentifier ? { voice: asideVoiceIdentifier } : {}),
  });
}

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
      enqueueSpeech(cue.text, {
        language: 'ko-KR',
        rate: fallbackSpeechRate,
        pitch: fallbackSpeechPitch,
        ...(fallbackVoiceIdentifier ? { voice: fallbackVoiceIdentifier } : {}),
      });
    }
    fallbackCueTimer = setTimeout(pump, 500);
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
  gender: VoiceGender = 'female',
): Promise<CoachRuntimeState> {
  const sessionId = Crypto.randomUUID();
  const startedAtEpochMillis = Date.now();
  const voices = await availableVoices();
  const voiceIdentifier = selectVoiceIdentifier(voices, gender);
  const tuning = voiceTuning(session.typeId, gender, session.guidance, speechRate);

  // 짧은 안내도 코치와 같은 목소리·속도로 말하도록 맞춰 둡니다.
  asideSpeechRate = tuning.rate;
  asideSpeechPitch = tuning.pitch;
  asideVoiceIdentifier = voiceIdentifier;

  if (nativeCoachAvailable()) {
    try {
      await RunningbomCoachModule.startSession(
        sessionId,
        session.id,
        session.title,
        session.countsAs,
        session.durationMinutes * 60,
        cueScheduleForNative(session),
        { rate: tuning.rate, voiceId: voiceIdentifier ?? '', pitch: tuning.pitch },
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

  clearSpeechQueue();
  fallbackState = startFallbackClock({
    sessionId,
    definitionId: session.id,
    title: session.title,
    countsAs: session.countsAs,
    durationSeconds: session.durationMinutes * 60,
  }, startedAtEpochMillis);
  fallbackSession = session;
  fallbackCueIndex = 0;
  fallbackSpeechRate = tuning.rate;
  fallbackSpeechPitch = tuning.pitch;
  fallbackVoiceIdentifier = voiceIdentifier;
  scheduleFallbackCuePump();
  return runtimeFromFallback(fallbackState);
}

export async function pauseCoachSession(): Promise<CoachRuntimeState> {
  // 멈추는 순간에는 짧은 안내도 함께 끊습니다(네이티브 코치를 쓸 때도 마찬가지입니다).
  clearSpeechQueue();
  if (nativeCoachAvailable() && !fallbackInUse) {
    await RunningbomCoachModule.pauseSession();
    return getCoachState();
  }
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
  clearSpeechQueue();
  if (nativeCoachAvailable() && !fallbackInUse) {
    await RunningbomCoachModule.stopSession();
    return getCoachState();
  }
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
