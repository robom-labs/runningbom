// 달리는 중 실제로 잰 숫자(거리·시간·페이스)를 자연스러운 한국어 한 문장으로 바꾸는 순수 함수입니다.
// 숫자를 읽어 주기만 하지 않고 "방금 구간이 평균보다 빨랐다" 같은 해석을 한 마디 덧붙입니다.
// 비교할 것이 없으면(첫 1km) 비교 문장을 만들지 않습니다.

/** 어떤 계기로 말하는지입니다. 'distance'는 1km를 지날 때, 'time'은 정해 둔 시간마다입니다. */
export type LiveStatsTrigger = 'distance' | 'time';

export type LiveStatsMode = 'off' | 'distance' | 'time' | 'both';

export const liveStatsModes: readonly LiveStatsMode[] = ['off', 'distance', 'time', 'both'];

export const liveStatsModeLabels: Record<LiveStatsMode, string> = {
  off: '끄기',
  distance: '구간마다',
  time: '시간마다',
  both: '둘 다',
};

export const liveStatsModeDescriptions: Record<LiveStatsMode, string> = {
  off: '지금 기록을 말로 알려 주지 않아요.',
  distance: '1km를 지날 때마다 지금 기록을 말해 줘요.',
  time: '정해 둔 시간마다 지금 기록을 말해 줘요.',
  both: '1km를 지날 때와 정해 둔 시간마다 모두 말해 줘요.',
};

/** 설정에서 고를 수 있는 시간 간격(분)입니다. */
export const liveStatsIntervalChoices: readonly number[] = [3, 5, 10];

/** 이 차이 안쪽이면 "일정하다"고 말합니다. */
export const STEADY_PACE_SECONDS = 3;

export function isLiveStatsMode(value: unknown): value is LiveStatsMode {
  return typeof value === 'string' && (liveStatsModes as readonly string[]).includes(value);
}

export type LiveStatsInput = {
  distanceMeters: number;
  elapsedSeconds: number;
  /** 지금까지의 평균 페이스(1km당 초)입니다. */
  averagePaceSecondsPerKm?: number;
  /** 방금 끝난 1km 구간의 페이스(1km당 초)입니다. */
  lastSplitPaceSecondsPerKm?: number;
  /** 지금까지 확정한 1km 구간 수입니다. 2개부터 비교 문장을 만듭니다. */
  completedSplits: number;
};

/** "5분 42초"처럼 사람이 말하듯 페이스를 읽습니다. */
export function spokenPaceShort(secondsPerKm: number): string {
  const rounded = Math.round(secondsPerKm);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  if (minutes <= 0) return `${seconds}초`;
  if (seconds === 0) return `${minutes}분`;
  return `${minutes}분 ${seconds}초`;
}

function distanceText(meters: number): string {
  const kilometers = meters / 1_000;
  const rounded = Math.round(kilometers * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}km` : `${rounded.toFixed(1)}km`;
}

function headSentence(input: LiveStatsInput, trigger: LiveStatsTrigger): string {
  if (trigger === 'distance') {
    const milestone = Math.floor(input.distanceMeters / 1_000);
    return `${milestone}km 지났어요.`;
  }
  const minutes = Math.max(1, Math.round(input.elapsedSeconds / 60));
  if (input.distanceMeters <= 0) return `${minutes}분 달렸어요.`;
  return `${minutes}분 달렸어요. 지금 ${distanceText(input.distanceMeters)} 왔어요.`;
}

/**
 * 방금 구간이 평균과 견줘 어땠는지 한 마디를 만듭니다.
 * 비교 대상이 없으면(첫 1km, 구간이 하나뿐) undefined를 돌려주고 비교 문장을 만들지 않습니다.
 */
export function paceComparison(input: LiveStatsInput): string | undefined {
  if (input.completedSplits < 2) return undefined;
  const average = input.averagePaceSecondsPerKm;
  const last = input.lastSplitPaceSecondsPerKm;
  if (average === undefined || last === undefined) return undefined;
  if (!Number.isFinite(average) || !Number.isFinite(last) || average <= 0 || last <= 0) {
    return undefined;
  }

  const difference = Math.round(average - last);
  if (Math.abs(difference) <= STEADY_PACE_SECONDS) return '페이스가 아주 일정해요.';
  if (difference > 0) return `방금 1km는 ${difference}초 빨랐어요.`;
  return `방금 1km는 ${Math.abs(difference)}초 느렸어요. 편하게 가도 괜찮아요.`;
}

/**
 * 지금 기록을 말해 줄 한 문장을 만듭니다.
 * 평균 페이스를 아직 못 구했으면 거리·시간만 말하고 숫자를 지어내지 않습니다.
 */
export function liveStatsSentence(
  input: LiveStatsInput,
  trigger: LiveStatsTrigger,
): string | undefined {
  if (!Number.isFinite(input.distanceMeters) || !Number.isFinite(input.elapsedSeconds)) {
    return undefined;
  }
  if (trigger === 'distance' && input.distanceMeters < 1_000) return undefined;
  if (trigger === 'time' && input.elapsedSeconds < 30) return undefined;

  const head = headSentence(input, trigger);
  const average = input.averagePaceSecondsPerKm;
  if (average === undefined || !Number.isFinite(average) || average <= 0) return head;

  const comparison = paceComparison(input);
  if (!comparison) return `${head} 평균 ${spokenPaceShort(average)}예요.`;
  return `${head} 평균 ${spokenPaceShort(average)}, ${comparison}`;
}

export type LiveStatsState = {
  /** 마지막으로 말해 준 킬로미터 지점입니다. */
  lastMilestoneKm: number;
  /** 마지막으로 말해 준 시각(세션 시작 후 초)입니다. */
  lastSpokenSeconds: number;
};

export const initialLiveStatsState: LiveStatsState = { lastMilestoneKm: 0, lastSpokenSeconds: 0 };

export type LiveStatsOptions = {
  mode: LiveStatsMode;
  intervalMinutes: number;
};

export type LiveStatsCue = {
  text: string;
  trigger: LiveStatsTrigger;
  state: LiveStatsState;
};

/**
 * 지금 말해야 할 문장이 있으면 만들어 줍니다.
 * - 1km 안내와 시간 안내가 겹치면 1km 안내만 하고, 시간 안내는 다음 차례로 미룹니다.
 * - 한 번 말할 때마다 시간 계산도 다시 시작해 문장이 몰려 나오지 않게 합니다.
 */
export function nextLiveStatsCue(
  state: LiveStatsState,
  input: LiveStatsInput,
  options: LiveStatsOptions,
): LiveStatsCue | undefined {
  if (options.mode === 'off') return undefined;

  const milestone = Math.floor(input.distanceMeters / 1_000);
  const distanceDue =
    (options.mode === 'distance' || options.mode === 'both') && milestone > state.lastMilestoneKm;

  if (distanceDue) {
    const text = liveStatsSentence(input, 'distance');
    if (text) {
      return {
        text,
        trigger: 'distance',
        state: { lastMilestoneKm: milestone, lastSpokenSeconds: input.elapsedSeconds },
      };
    }
  }

  const intervalSeconds = Math.max(1, Math.round(options.intervalMinutes)) * 60;
  const timeDue =
    (options.mode === 'time' || options.mode === 'both') &&
    input.elapsedSeconds - state.lastSpokenSeconds >= intervalSeconds;

  if (timeDue) {
    const text = liveStatsSentence(input, 'time');
    if (text) {
      return {
        text,
        trigger: 'time',
        state: {
          lastMilestoneKm: Math.max(state.lastMilestoneKm, milestone),
          lastSpokenSeconds: input.elapsedSeconds,
        },
      };
    }
  }

  return undefined;
}
