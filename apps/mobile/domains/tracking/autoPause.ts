// 신호등·건널목에서 멈추면 스스로 기록을 멈추고, 다시 달리면 이어 가는 판정기입니다.
// 새 센서 라이브러리나 새 권한 없이 GPS 속도만 보고 판단하며, 판정 규칙은 전부 이 파일의 순수 함수에 있습니다.
import type { LocationFix } from './filter';
import { haversineMeters } from './geo';

/** 사용자가 설정에서 고르는 네 단계입니다. */
export type AutoPauseLevel = 'off' | 'loose' | 'normal' | 'strict';

export const autoPauseLevels: readonly AutoPauseLevel[] = ['off', 'loose', 'normal', 'strict'];

export type AutoPauseTuning = {
  level: AutoPauseLevel;
  label: string;
  /** 이 속도보다 느려지면 "멈췄다"고 봅니다. (km/h) */
  pauseSpeedKmh: number;
  /** 멈췄다 켜졌다 하는 것을 막으려고 다시 시작 기준은 더 빠르게 잡습니다. (km/h) */
  resumeSpeedKmh: number;
  /** 설정 화면에 그대로 쓰는 한 줄 설명입니다. */
  description: string;
};

/**
 * 단계별 속도입니다. 화면에는 항상 이 km/h 값을 그대로 보여 줍니다.
 * 다시 시작 기준을 멈춤 기준보다 높게 둔 이유는, 걷는 정도로는 다시 시작되지 않게 하기 위해서입니다.
 */
export const autoPauseTunings: Record<AutoPauseLevel, AutoPauseTuning> = {
  off: {
    level: 'off',
    label: '끄기',
    pauseSpeedKmh: 0,
    resumeSpeedKmh: 0,
    description: '스스로 멈추지 않아요. 멈춤·다시 시작 버튼으로만 조절해요.',
  },
  loose: {
    level: 'loose',
    label: '느슨하게',
    pauseSpeedKmh: 2.5,
    resumeSpeedKmh: 3.8,
    description: '거의 멈춰 섰을 때만 기록을 멈춰요. 천천히 걷는 것도 러닝으로 세요.',
  },
  normal: {
    level: 'normal',
    label: '보통',
    pauseSpeedKmh: 4,
    resumeSpeedKmh: 6,
    description: '천천히 걷는 속도보다 느려지면 멈춰요. 대부분의 신호등에 맞아요.',
  },
  strict: {
    level: 'strict',
    label: '엄격하게',
    pauseSpeedKmh: 6,
    resumeSpeedKmh: 9,
    description: '빠르게 걸어도 멈춰요. 다시 뛰어야 이어서 기록해요.',
  },
};

/** 임계값 아래가 이만큼 이어지면 멈춥니다. */
export const AUTO_PAUSE_HOLD_SECONDS = 10;
/** 임계값 위가 이만큼 이어지면 다시 시작합니다. 멈춤보다 조건을 까다롭게 두었습니다. */
export const AUTO_RESUME_HOLD_SECONDS = 5;
/** 이 시간 넘게 새 위치가 안 들어오면 "멈춤"이 아니라 "신호를 찾는 중"으로 봅니다. */
export const AUTO_PAUSE_SIGNAL_GAP_SECONDS = 12;

export const AUTO_PAUSE_HOLD_MILLIS = AUTO_PAUSE_HOLD_SECONDS * 1_000;
export const AUTO_RESUME_HOLD_MILLIS = AUTO_RESUME_HOLD_SECONDS * 1_000;
export const AUTO_PAUSE_SIGNAL_GAP_MILLIS = AUTO_PAUSE_SIGNAL_GAP_SECONDS * 1_000;

export function isAutoPauseLevel(value: unknown): value is AutoPauseLevel {
  return typeof value === 'string' && (autoPauseLevels as readonly string[]).includes(value);
}

export type AutoPauseState = {
  /** 자동 판정이 보는 지금 상태입니다. */
  phase: 'moving' | 'paused';
  /** 임계값 아래로 내려간 시각입니다. 위로 올라오면 지웁니다. */
  belowSinceMillis?: number;
  /** 임계값 위로 올라간 시각입니다. 아래로 내려가면 지웁니다. */
  aboveSinceMillis?: number;
  /** 지금 속도를 알 수 없는 상태(신호 없음)인지. */
  searching: boolean;
};

export const initialAutoPauseState: AutoPauseState = { phase: 'moving', searching: false };

export type AutoPauseSample = {
  /** 지금 속도(km/h). 신호가 없어 알 수 없으면 넣지 않습니다. */
  speedKmh?: number;
  timestampMillis: number;
};

export type AutoPauseEvent = 'paused' | 'resumed';

export type AutoPauseUpdate = {
  state: AutoPauseState;
  /** 이번 판정에서 상태가 바뀌었을 때만 값이 있습니다. */
  event?: AutoPauseEvent;
};

const metersPerSecondToKmh = (value: number) => value * 3.6;

/** 사람이 달릴 수 있는 최대치를 크게 넘는 값은 GPS 튐으로 보고 속도로 쓰지 않습니다. */
const IMPLAUSIBLE_SPEED_KMH = 45;

/**
 * 좌표 하나에서 지금 속도(km/h)를 구합니다.
 * 단말이 알려 준 속도가 있으면 그 값을 먼저 쓰고, 없으면 직전 좌표와의 거리·시간으로 구합니다.
 * 값을 믿을 수 없으면 undefined를 돌려주고, 호출자는 그때 "신호를 찾는 중"으로 다룹니다.
 */
export function speedKmhFromFixes(
  previous: LocationFix | undefined,
  fix: LocationFix,
): number | undefined {
  const reported = fix.speedMetersPerSecond;
  if (typeof reported === 'number' && Number.isFinite(reported) && reported >= 0) {
    const kmh = metersPerSecondToKmh(reported);
    return kmh > IMPLAUSIBLE_SPEED_KMH ? undefined : kmh;
  }

  if (!previous) return undefined;
  const seconds = (fix.timestampMillis - previous.timestampMillis) / 1_000;
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > AUTO_PAUSE_SIGNAL_GAP_SECONDS) {
    return undefined;
  }

  const meters = haversineMeters(
    { latitudeDeg: previous.latitudeDeg, longitudeDeg: previous.longitudeDeg },
    { latitudeDeg: fix.latitudeDeg, longitudeDeg: fix.longitudeDeg },
  );
  const kmh = metersPerSecondToKmh(meters / seconds);
  if (!Number.isFinite(kmh) || kmh > IMPLAUSIBLE_SPEED_KMH) return undefined;
  return kmh;
}

/**
 * 속도 하나를 반영해 다음 상태를 만듭니다.
 * - 신호가 없으면(속도 모름) 절대 멈추지 않고, 세고 있던 시간도 지웁니다.
 * - 멈춤은 임계값 아래가 10초 이어질 때, 다시 시작은 더 빠른 기준 위가 5초 이어질 때입니다.
 */
export function updateAutoPause(
  state: AutoPauseState,
  sample: AutoPauseSample,
  level: AutoPauseLevel,
): AutoPauseUpdate {
  if (level === 'off') return { state: initialAutoPauseState };

  const tuning = autoPauseTunings[level];
  const now = sample.timestampMillis;
  const speed = sample.speedKmh;

  // 신호가 없을 때는 판정을 멈춥니다. 지하도·건물 사이에서 멈춘 것처럼 보이는 일을 막습니다.
  if (speed === undefined || !Number.isFinite(speed)) {
    return {
      state: { phase: state.phase, searching: true },
    };
  }

  if (state.phase === 'moving') {
    if (speed >= tuning.pauseSpeedKmh) {
      return { state: { phase: 'moving', searching: false } };
    }
    const since = state.belowSinceMillis ?? now;
    if (now - since >= AUTO_PAUSE_HOLD_MILLIS) {
      return { state: { phase: 'paused', searching: false }, event: 'paused' };
    }
    return { state: { phase: 'moving', searching: false, belowSinceMillis: since } };
  }

  if (speed <= tuning.resumeSpeedKmh) {
    return { state: { phase: 'paused', searching: false } };
  }
  const since = state.aboveSinceMillis ?? now;
  if (now - since >= AUTO_RESUME_HOLD_MILLIS) {
    return { state: { phase: 'moving', searching: false }, event: 'resumed' };
  }
  return { state: { phase: 'paused', searching: false, aboveSinceMillis: since } };
}

/** 화면을 불필요하게 다시 그리지 않도록 두 상태가 같은지 비교합니다. */
export function sameAutoPauseState(left: AutoPauseState, right: AutoPauseState): boolean {
  return (
    left.phase === right.phase &&
    left.searching === right.searching &&
    left.belowSinceMillis === right.belowSinceMillis &&
    left.aboveSinceMillis === right.aboveSinceMillis
  );
}

/** 자동 멈춤·다시 시작을 알릴 때 쓰는 문구입니다. 화면과 음성 양쪽에 같은 뜻으로 씁니다. */
export const autoPauseAnnouncements: Record<
  AutoPauseEvent,
  { screen: string; voice: string }
> = {
  paused: {
    screen: '잠시 멈췄어요. 기록도 함께 멈췄어요.',
    voice: '잠시 멈췄어요. 다시 달리면 이어서 기록할게요.',
  },
  resumed: {
    screen: '다시 달리기 시작했어요. 기록도 이어서 쌓여요.',
    voice: '다시 시작할게요.',
  },
};

export type AutoPauseStatus = {
  label: string;
  detail: string;
};

/** 달리는 화면에 지금 무슨 일이 일어나고 있는지 한 줄로 보여 줍니다. 보여 줄 것이 없으면 undefined입니다. */
export function autoPauseStatus(
  state: AutoPauseState,
  level: AutoPauseLevel,
  nowMillis: number,
): AutoPauseStatus | undefined {
  if (level === 'off') return undefined;

  if (state.searching) {
    return {
      label: '신호를 찾는 중',
      detail: '신호를 못 받는 동안에는 스스로 멈추지 않아요.',
    };
  }

  if (state.phase === 'paused') {
    return {
      label: '잠시 멈춤',
      detail: `다시 시속 ${formatSpeedKmh(autoPauseTunings[level].resumeSpeedKmh)}보다 빨라지면 스스로 이어서 기록해요.`,
    };
  }

  if (state.belowSinceMillis !== undefined) {
    const left = Math.max(
      1,
      Math.ceil((AUTO_PAUSE_HOLD_MILLIS - (nowMillis - state.belowSinceMillis)) / 1_000),
    );
    return {
      label: '멈췄는지 보는 중',
      detail: `이대로 ${left}초 더 느리면 기록을 잠시 멈출게요.`,
    };
  }

  return undefined;
}

/** 3.8처럼 소수 첫째 자리까지 보여 주되, 4.0은 4km로 짧게 읽히도록 다듬습니다. */
export function formatSpeedKmh(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}km`;
}

/** 설정 화면에서 단계마다 몇 km/h인지 그대로 보여 주는 한 줄입니다. */
export function autoPauseSpeedSummary(level: AutoPauseLevel): string {
  const tuning = autoPauseTunings[level];
  if (level === 'off') return '멈춤·다시 시작을 손으로만 눌러요.';
  return `시속 ${formatSpeedKmh(tuning.pauseSpeedKmh)}보다 느리면 ${AUTO_PAUSE_HOLD_SECONDS}초 뒤 멈추고, 시속 ${formatSpeedKmh(
    tuning.resumeSpeedKmh,
  )}보다 빠르면 ${AUTO_RESUME_HOLD_SECONDS}초 뒤 다시 시작해요.`;
}
