// Android 네이티브 foreground 코치와 iOS의 안전한 화면·음성 fallback을 하나로 감쌉니다.
import * as Speech from 'expo-speech';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

import RunningbomCoachModule from '../../modules/runningbom-coach/src/RunningbomCoachModule';
import type { ActivityKind } from '../../domains/activities/types';
import type { CoachSession } from '../../domains/coaching/model';
import { cueScheduleForNative } from '../../domains/coaching/model';
import {
  dueCues,
  MAX_SPOKEN_CUES_PER_TICK,
  speechWatchdogMillis,
} from '../../domains/coaching/cuePump';
import { toSpeech } from '../../domains/coaching/speechText';
import { loadCoachVoicePick, type CoachVoicePick } from '../../app/screens/voice/voicePickStorage';
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
  openEnded?: boolean;
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
  cachedPick = undefined;
}

// 사용자가 "목소리 고르기" 화면에서 직접 고른 값입니다. 자동 선택보다 항상 앞섭니다.
let cachedPick: CoachVoicePick | undefined;

async function currentPick(): Promise<CoachVoicePick> {
  if (!cachedPick) cachedPick = await loadCoachVoicePick();
  return cachedPick;
}

/** 직접 고른 목소리를 우선 적용해 최종 식별자를 정합니다. */
async function resolveVoice(
  voices: SpeechVoiceLike[],
  gender: VoiceGender,
): Promise<{ identifier?: string; pick: CoachVoicePick }> {
  const pick = await currentPick();
  const identifier = selectVoiceIdentifier(voices, gender, pick.identifier);
  return { ...(identifier ? { identifier } : {}), pick };
}

/** 직접 고른 빠르기·높낮이를 자동 계산값 위에 덧씌웁니다. */
function applyPick(
  tuning: { rate: number; pitch: number },
  pick: CoachVoicePick,
): { rate: number; pitch: number } {
  return {
    rate: pick.rate ?? tuning.rate,
    pitch: pick.pitch ?? tuning.pitch,
  };
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
let speechWatchdog: ReturnType<typeof setTimeout> | undefined;

/** 밀렸을 때 남겨 두는 최대 개수입니다. 지난 이야기를 되풀이하지 않으면서 연속 두 마디는 살립니다. */
const MAX_PENDING_SPEECH = MAX_SPOKEN_CUES_PER_TICK;

function clearSpeechWatchdog() {
  if (speechWatchdog) clearTimeout(speechWatchdog);
  speechWatchdog = undefined;
}

function drainSpeechQueue() {
  if (speaking) return;
  const job = speechQueue.shift();
  if (!job) return;
  speaking = true;

  // 같은 발화에 대해 끝 신호와 감시 타이머가 모두 울려도 한 번만 넘어가게 합니다.
  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    clearSpeechWatchdog();
    speaking = false;
    drainSpeechQueue();
  };

  clearSpeechWatchdog();
  speechWatchdog = setTimeout(finish, speechWatchdogMillis(job.text, job.options.rate ?? 1));

  try {
    Speech.speak(job.text, {
      ...job.options,
      onDone: finish,
      onStopped: finish,
      onError: finish,
    });
  } catch {
    // 말하기 자체가 실패해도 큐는 계속 흘러야 합니다.
    finish();
  }
}

function enqueueSpeech(text: string, options: Speech.SpeechOptions) {
  // 화면에 쓰는 글과 읽어 줄 글을 분리합니다. 원문은 그대로 두고 말하기 직전에만 다듬습니다.
  speechQueue.push({ text: toSpeech(text), options });
  // 코치는 지난 이야기를 되풀이하지 않습니다. 너무 밀리면 최근 것만 남깁니다.
  if (speechQueue.length > MAX_PENDING_SPEECH) {
    speechQueue = speechQueue.slice(-MAX_PENDING_SPEECH);
  }
  drainSpeechQueue();
}

function clearSpeechQueue() {
  speechQueue = [];
  speaking = false;
  clearSpeechWatchdog();
  void Speech.stop();
}

export async function previewCoachVoice(
  gender: VoiceGender,
  speechRate = 1,
): Promise<void> {
  const voices = await availableVoices();
  const { identifier, pick } = await resolveVoice(voices, gender);
  const tuning = applyPick(voiceTuning('easy', gender, 'standard', speechRate), pick);
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
    const { identifier, pick } = await resolveVoice(voices, gender);
    const tuning = applyPick(voiceTuning('easy', gender, 'standard', speechRate), pick);
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

    // 세션이 없거나 이미 끝났으면 여기서 멈춥니다.
    if (!fallbackSession) return;
    if (fallbackState.state === 'completed' || fallbackState.state === 'stopped') return;
    if (fallbackState.state === 'idle') return;

    // 잠시 멈춤 상태여도 타이머는 살려 둡니다.
    //
    // 예전에는 running이 아니면 다시 예약하지 않고 그냥 빠져나갔습니다.
    // 그래서 한 번이라도 running이 아닌 순간을 보면 그 뒤로 영영 아무 말도 하지 않았습니다.
    if (fallbackState.state === 'running') {
      // 같은 순간에 여러 대사가 밀렸어도 하나만 읽고 버리지 않습니다.
      const { spoken, nextIndex } = dueCues(
        fallbackSession.cues,
        fallbackCueIndex,
        fallbackState.elapsedSeconds,
      );
      fallbackCueIndex = nextIndex;
      for (const cue of spoken) {
        lastSpokenOffsetSeconds = cue.offsetSeconds;
        enqueueSpeech(cue.text, {
          language: 'ko-KR',
          rate: fallbackSpeechRate,
          pitch: fallbackSpeechPitch,
          ...(fallbackVoiceIdentifier ? { voice: fallbackVoiceIdentifier } : {}),
        });
      }
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
    ...(clock.openEnded ? { openEnded: true } : {}),
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
  return (Platform.OS === 'android' || Platform.OS === 'ios')
    && RunningbomCoachModule.isAvailable();
}

/**
 * 누가 말할지입니다.
 *
 *  - `native`: Android 포그라운드 서비스가 시간도 재고 말도 합니다(자유 러닝의 기존 동작).
 *  - `app`: 시간·화면 잠금 유지는 서비스가 맡고, **말은 앱이 직접** 합니다.
 *
 * `app`을 만든 이유:
 *   프로그램 회차에서 첫 대사만 들리고 그 뒤로 조용하다는 신고가 두 번 들어왔습니다.
 *   회차 음성은 서비스의 대사표에만 의존하고 있었고, 그 서비스가 첫 대사 뒤 조용히
 *   멈추는 것을 앱에서는 볼 수도 고칠 수도 없습니다(서비스는 네이티브라 원격 수정이 안 됩니다).
 *   반면 앱이 직접 말하는 경로(카운트다운·자동 멈춤·중간 기록 안내)는 같은 기기에서
 *   잘 들리고 있습니다. 그래서 회차는 들리는 것이 확인된 경로로 옮깁니다.
 *
 * 두 곳에서 같이 말하면 겹치므로, `app`일 때는 서비스에 **빈 대사표**를 넘깁니다.
 */
export type CoachSpeechOwner = 'native' | 'app';

export type CoachStartOptions = {
  speechOwner?: CoachSpeechOwner;
};

/** 앱이 직접 말하는 중인지입니다(네이티브가 시간만 재는 상태). */
let appSpeechActive = false;

/** 지금 음성이 어떤 경로로 나가고 있는지 화면에 보여 주기 위한 값입니다. */
export type CoachSpeechDiagnostics = {
  owner: CoachSpeechOwner | 'none';
  /** 마지막으로 말한 대사의 시각(초)입니다. 아직 없으면 undefined입니다. */
  lastSpokenOffsetSeconds?: number;
  /** 앞으로 말할 대사가 몇 개 남았는지입니다. */
  remainingCues: number;
};

let lastSpokenOffsetSeconds: number | undefined;

export function coachSpeechDiagnostics(): CoachSpeechDiagnostics {
  // 대사표를 들고 있지 않으면 앱은 아직 말할 준비가 안 된 것입니다.
  // 이 경우를 'native'로 뭉뚱그리면 "왜 조용한지" 화면에서 알 수 없습니다.
  if (!fallbackSession) return { owner: 'none', remainingCues: 0 };
  return {
    // 앱 시계와 대사표를 들고 있으면 말하는 주체는 앱입니다(네이티브 실패로 넘어온 경우 포함).
    owner: 'app',
    ...(lastSpokenOffsetSeconds === undefined ? {} : { lastSpokenOffsetSeconds }),
    remainingCues: Math.max(0, fallbackSession.cues.length - fallbackCueIndex),
  };
}

export async function startCoachSession(
  session: CoachSession,
  speechRate = 1,
  gender: VoiceGender = 'female',
  options: CoachStartOptions = {},
): Promise<CoachRuntimeState> {
  const speechOwner: CoachSpeechOwner = options.speechOwner ?? 'native';
  const startedAtEpochMillis = Date.now();

  // 여기서 실패하면 음성이 통째로 안 켜집니다. 그런데 실패해도 기기 기본 목소리로 말할 수 있습니다.
  // 예전에는 목소리를 고르다 예외가 나면 startCoachSession 전체가 거절되고,
  // 화면은 그 예외를 조용히 삼켜서 "아무 말도 안 하는데 이유도 모르는" 상태가 됐습니다.
  // 목소리 고르기는 있으면 좋은 것이지, 말하기의 전제 조건이 아닙니다.
  let sessionId: string;
  try {
    sessionId = Crypto.randomUUID();
  } catch {
    sessionId = `coach-${startedAtEpochMillis}`;
  }

  let voiceIdentifier: string | undefined;
  let tuning = { rate: speechRate, pitch: 1 };
  try {
    const voices = await availableVoices();
    const resolved = await resolveVoice(voices, gender);
    voiceIdentifier = resolved.identifier;
    tuning = applyPick(
      voiceTuning(session.typeId, gender, session.guidance, speechRate),
      resolved.pick,
    );
  } catch {
    // 기기 기본 한국어 음성으로 말합니다. 안 들리는 것보다 낫습니다.
  }

  // 짧은 안내도 코치와 같은 목소리·속도로 말하도록 맞춰 둡니다.
  asideSpeechRate = tuning.rate;
  asideSpeechPitch = tuning.pitch;
  asideVoiceIdentifier = voiceIdentifier;

  /** 앱이 말할 준비를 합니다(시계·대사표·목소리). */
  const armAppSpeech = () => {
    clearSpeechQueue();
    fallbackState = startFallbackClock({
      sessionId,
      definitionId: session.id,
      title: session.title,
      countsAs: session.countsAs,
      durationSeconds: session.durationMinutes * 60,
      openEnded: session.extent?.type === 'open-ended',
    }, startedAtEpochMillis);
    fallbackSession = session;
    fallbackCueIndex = 0;
    fallbackSpeechRate = tuning.rate;
    fallbackSpeechPitch = tuning.pitch;
    fallbackVoiceIdentifier = voiceIdentifier;
    lastSpokenOffsetSeconds = undefined;
    scheduleFallbackCuePump();
  };

  if (nativeCoachAvailable()) {
    try {
      await RunningbomCoachModule.startSession(
        sessionId,
        session.id,
        session.title,
        session.countsAs,
        session.durationMinutes * 60,
        // 앱이 말할 때는 서비스에 대사를 주지 않습니다. 두 곳이 같이 말하면 겹칩니다.
        speechOwner === 'app' ? '' : cueScheduleForNative(session),
        {
          rate: tuning.rate,
          voiceId: voiceIdentifier ?? '',
          pitch: tuning.pitch,
          openEnded: session.extent?.type === 'open-ended',
        },
      );
      fallbackInUse = false;
      if (speechOwner === 'app') {
        // 시간과 화면 잠금 유지는 서비스가, 말하기는 앱이 맡습니다.
        appSpeechActive = true;
        armAppSpeech();
        return getCoachState();
      }
      appSpeechActive = false;
      fallbackState = idleFallbackClock;
      fallbackSession = undefined;
      lastSpokenOffsetSeconds = undefined;
      clearFallbackCueTimer();
      return getCoachState();
    } catch {
      fallbackInUse = true;
    }
  } else {
    fallbackInUse = true;
  }

  appSpeechActive = false;
  armAppSpeech();
  return runtimeFromFallback(fallbackState);
}

/**
 * 음성을 화면의 시각에 맞춥니다.
 *
 * 왜 필요한가:
 *   회차 화면에는 "다음 구간으로" 버튼이 있습니다. 누르면 화면 시간이 훌쩍 뜁니다.
 *   그런데 음성은 자기 시계로만 돌고 있어서, 화면은 달리기 구간인데 음성은
 *   아직 걷기 구간을 안내하고 있었습니다. 두 시계가 따로 놀던 것입니다.
 *
 * 하는 일:
 *   1) 음성 시계를 그 시각으로 옮기고
 *   2) 이미 지나간 안내는 말하지 않고 건너뛰되
 *   3) **그 시점에 해당하는 안내 한 마디는 지금 바로 말합니다.**
 *      구간을 건너뛰었는데 아무 말이 없으면 무엇을 할 차례인지 알 수 없습니다.
 */
export function seekCoachSpeech(elapsedSeconds: number): void {
  if (!fallbackSession) return;
  const target = Math.max(0, Math.round(elapsedSeconds));

  // 시계를 옮깁니다. 흐르던 상태는 그대로 두고 경과만 바꿉니다.
  fallbackState = {
    ...fallbackState,
    elapsedSeconds: fallbackState.openEnded
      ? target
      : Math.min(fallbackState.durationSeconds, target),
    ...(fallbackState.state === 'running' ? { runningSinceEpochMillis: Date.now() } : {}),
  };

  // 그 시각까지의 안내 중 마지막 한 마디만 지금 말합니다.
  const { spoken, nextIndex } = dueCues(fallbackSession.cues, 0, target, 1);
  fallbackCueIndex = nextIndex;
  const cue = spoken[spoken.length - 1];
  if (cue && cue.offsetSeconds !== lastSpokenOffsetSeconds) {
    lastSpokenOffsetSeconds = cue.offsetSeconds;
    clearSpeechQueue();
    enqueueSpeech(cue.text, {
      language: 'ko-KR',
      rate: fallbackSpeechRate,
      pitch: fallbackSpeechPitch,
      ...(fallbackVoiceIdentifier ? { voice: fallbackVoiceIdentifier } : {}),
    });
  }
  scheduleFallbackCuePump();
}

/**
 * 화면의 시각과 음성 시계가 어긋났으면 맞춥니다.
 * 어긋남이 작으면 아무것도 하지 않습니다(매초 다시 맞추면 말이 끊깁니다).
 */
export const COACH_DRIFT_TOLERANCE_SECONDS = 3;

export function syncCoachSpeech(elapsedSeconds: number): void {
  if (!fallbackSession) return;
  const drift = Math.abs(fallbackState.elapsedSeconds - elapsedSeconds);
  if (drift <= COACH_DRIFT_TOLERANCE_SECONDS) return;
  seekCoachSpeech(elapsedSeconds);
}

export async function pauseCoachSession(): Promise<CoachRuntimeState> {
  // 멈추는 순간에는 짧은 안내도 함께 끊습니다(네이티브 코치를 쓸 때도 마찬가지입니다).
  clearSpeechQueue();
  // 앱이 말하는 중이면 앱 시계도 함께 멈춰야 합니다. 안 그러면 멈춘 동안에도 계속 말합니다.
  if (appSpeechActive) {
    clearFallbackCueTimer();
    fallbackState = pauseFallbackClock(fallbackState, Date.now());
  }
  if (nativeCoachAvailable() && !fallbackInUse) {
    await RunningbomCoachModule.pauseSession();
    return getCoachState();
  }
  clearFallbackCueTimer();
  fallbackState = pauseFallbackClock(fallbackState, Date.now());
  return runtimeFromFallback(fallbackState);
}

export async function resumeCoachSession(): Promise<CoachRuntimeState> {
  if (appSpeechActive) {
    fallbackState = resumeFallbackClock(fallbackState, Date.now());
    scheduleFallbackCuePump();
  }
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
  if (appSpeechActive) {
    clearFallbackCueTimer();
    fallbackSession = undefined;
    appSpeechActive = false;
    fallbackState = stopFallbackClock(fallbackState, Date.now());
  }
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
    ...(value.openEnded ? { openEnded: true } : {}),
    ...(value.startedAtEpochMillis
      ? { startedAtEpochMillis: value.startedAtEpochMillis }
      : {}),
    ...(value.completedAtEpochMillis
      ? { completedAtEpochMillis: value.completedAtEpochMillis }
      : {}),
    native: true,
  };
}
