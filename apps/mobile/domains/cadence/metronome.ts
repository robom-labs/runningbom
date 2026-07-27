// 러닝 메트로놈 규칙입니다.
//
// 회장 지시: **"메트로놈 시스템을 하나, 러닝으로 최적화해서 별도 카테고리로 만들어 줘.
// 배경음악과 함께 쓸 수 있게."**
//
// 왜 러닝 전용인가:
//   음악용 메트로놈은 40~240을 자유롭게 놓고 씁니다. 러닝은 다릅니다.
//   케이던스(분당 발걸음 수)는 사람마다 정해진 범위가 있고, **갑자기 올리면 다칩니다.**
//   그래서 이 파일의 절반은 "빠르게 하는 법"이 아니라 **"급하게 못 올리게 막는 법"** 입니다.
//
// 안전 규칙 (이 파일에서 절대 풀지 않습니다):
//   1. 한 번에 5보 넘게 올리지 않습니다. 케이던스를 급히 바꾸면 종아리·정강이가 먼저 상합니다.
//   2. 200을 넘기지 않습니다. 그 위는 러닝이 아니라 다른 운동입니다.
//   3. 걷는 구간에서는 자동으로 멈춥니다. 걸으면서 달리기 박자를 들으면 방해만 됩니다.
//   4. 코치 음성이 나갈 때는 코치가 우선입니다. 박자는 잠깐 죽습니다.
//
// 이 파일은 순수합니다. 소리를 내지 않고, 값과 판단만 만듭니다.

/** 러닝에서 의미 있는 케이던스 범위입니다. */
export const MIN_CADENCE = 140;
export const MAX_CADENCE = 200;

/** 한 번에 올릴 수 있는 최대 폭입니다. 이걸 넘기면 다칩니다. */
export const MAX_STEP_UP = 5;

/** 처음 켰을 때의 값입니다. 대부분의 러너가 이 근처에 있습니다. */
export const DEFAULT_CADENCE = 170;

/**
 * 자주 쓰는 값 셋입니다.
 *
 * 케이던스 앱들이 쓰는 "많이 쓰는 값 먼저, 전체는 아래" 패턴을 그대로 씁니다(기획서 §4.6).
 * 스물한 개를 늘어놓으면 고르다 지칩니다.
 */
export const commonCadences = [160, 170, 180] as const;

export const cadenceNotes: Record<number, string> = {
  160: '천천히 오래 달릴 때 편해요',
  170: '가장 많이 쓰는 박자예요',
  180: '속도를 낼 때 자주 쓰는 박자예요',
};

/** 박자 하나 사이의 밀리초입니다. */
export function beatIntervalMillis(cadence: number): number {
  return 60_000 / clampCadence(cadence);
}

export function clampCadence(cadence: number): number {
  if (!Number.isFinite(cadence)) return DEFAULT_CADENCE;
  return Math.min(MAX_CADENCE, Math.max(MIN_CADENCE, Math.round(cadence)));
}

export type CadenceChange = {
  next: number;
  /** 원하던 값이 안전선에 걸려 깎였는지입니다. */
  limited: boolean;
  /** 깎였을 때 화면에 쓸 말입니다. 조용히 깎으면 고장으로 보입니다. */
  note?: string;
};

/**
 * 케이던스를 바꿉니다. **안전선을 여기서 지킵니다.**
 *
 * 올릴 때만 5보로 막습니다. 내리는 건 언제나 안전하므로 막지 않습니다.
 * 그리고 깎였으면 **반드시 말해 줍니다.** 조용히 깎으면 사용자는 앱이 고장 난 줄 압니다.
 */
export function changeCadence(current: number, wanted: number): CadenceChange {
  const from = clampCadence(current);
  const target = clampCadence(wanted);

  if (target <= from) return { next: target, limited: false };

  if (target - from > MAX_STEP_UP) {
    return {
      next: from + MAX_STEP_UP,
      limited: true,
      note: `한 번에 ${MAX_STEP_UP}보까지만 올려요. 급하게 바꾸면 종아리가 먼저 아파요.`,
    };
  }
  return { next: target, limited: false };
}

/**
 * 지금 내 케이던스에서 시작할 값입니다.
 *
 * 기록이 있으면 **거기서 시작**합니다. 남의 평균값에서 시작하면 첫 1분부터 어긋납니다.
 * 기록이 없으면 기본값입니다.
 */
export function startingCadence(recentCadence?: number): number {
  if (recentCadence === undefined) return DEFAULT_CADENCE;
  return clampCadence(recentCadence);
}

/**
 * 목표 케이던스를 권할 때 쓰는 값입니다.
 *
 * 지금보다 **5보까지만** 권합니다. "180이 좋다"고 아무에게나 말하지 않습니다.
 * 지금 155인 사람에게 180은 목표가 아니라 부상입니다.
 */
export function suggestedTarget(current: number): number {
  return clampCadence(clampCadence(current) + MAX_STEP_UP);
}

export type MetronomeContext = {
  /** 지금 회차 구간이 걷기인지입니다. */
  walking: boolean;
  /** 코치가 지금 말하고 있는지입니다. */
  coachSpeaking: boolean;
  /** 사용자가 켜 뒀는지입니다. */
  enabled: boolean;
};

export type MetronomeDecision = {
  /** 지금 소리를 낼지입니다. */
  playing: boolean;
  /** 안 나는 이유입니다. 화면에 그대로 씁니다. 이유 없이 조용하면 고장으로 보입니다. */
  reason?: string;
};

/**
 * 지금 박자를 낼지 정합니다.
 *
 * 순서가 곧 우선순위입니다.
 *   1) 꺼져 있으면 안 냅니다
 *   2) 코치가 말하면 코치가 먼저입니다 — 안내를 못 들으면 회차를 따라갈 수 없습니다
 *   3) 걷는 구간이면 멈춥니다 — 걸으면서 달리기 박자를 들으면 방해만 됩니다
 */
export function metronomeDecision(context: MetronomeContext): MetronomeDecision {
  if (!context.enabled) return { playing: false };
  if (context.coachSpeaking) {
    return { playing: false, reason: '코치가 말하는 동안은 잠깐 멈춰요' };
  }
  if (context.walking) {
    return { playing: false, reason: '걷는 구간이라 잠깐 멈췄어요' };
  }
  return { playing: true };
}

/**
 * 다음 박자까지 얼마나 기다릴지입니다. **흘러간 시간을 보정합니다.**
 *
 * 왜 필요한가:
 *   `setInterval(간격)`만 쓰면 자바스크립트가 다른 일을 하는 동안 박자가 조금씩 밀립니다.
 *   1분이면 못 느끼지만 30분 달리면 발과 소리가 눈에 띄게 어긋납니다.
 *   그래서 매번 "원래 몇 번째 박자여야 하는가"를 계산해 맞춥니다.
 */
export function nextBeatDelay(
  startedAtMillis: number,
  nowMillis: number,
  cadence: number,
): number {
  const interval = beatIntervalMillis(cadence);
  const elapsed = Math.max(0, nowMillis - startedAtMillis);
  const beatsPassed = Math.floor(elapsed / interval);
  const nextAt = (beatsPassed + 1) * interval;
  // 이미 지나갔으면 바로 칩니다(0 미만으로 내려가지 않습니다).
  return Math.max(0, nextAt - elapsed);
}

/** 화면에 쓰는 한 줄입니다. 숫자만 있으면 그게 빠른지 느린지 모릅니다. */
export function cadenceLabel(cadence: number): string {
  const value = clampCadence(cadence);
  const note = cadenceNotes[value];
  return note ? `분당 ${value}보 · ${note}` : `분당 ${value}보`;
}

/** 배경음악과 함께 쓸 때의 안내입니다. */
export const MUSIC_NOTE =
  '음악을 틀어 두고 같이 써도 돼요. 박자 소리는 음악 위에 얹혀요.';
