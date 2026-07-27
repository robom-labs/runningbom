// 달리는 중 경험(자동 멈춤·칼로리·기록 안내·야간 모드·시작 카운트다운) 설정만 따로 보관합니다.
// 기존 설정 파일(preferences.ts)과 그 저장 키는 건드리지 않고, 새 키 하나만 씁니다.
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  isValidWeightKg,
  MAX_WEIGHT_KG,
  MIN_WEIGHT_KG,
} from '../../domains/activities/calories';
import {
  isLiveStatsMode,
  liveStatsIntervalChoices,
  type LiveStatsMode,
} from '../../domains/coaching/liveStats';
import { isAutoPauseLevel, type AutoPauseLevel } from '../../domains/tracking/autoPause';

/** 새로 만드는 키입니다. 기존 키는 그대로 두고 여기에만 저장합니다. */
export const RUN_PREFERENCES_KEY = 'runningbom:run-experience:v1';

/** 달리는 화면을 어둡게 할지 정하는 값입니다. */
export type NightModeSetting = 'off' | 'on' | 'auto';

export const nightModeSettings: readonly NightModeSetting[] = ['off', 'on', 'auto'];

export const nightModeLabels: Record<NightModeSetting, string> = {
  off: '끄기',
  on: '항상 어둡게',
  auto: '해 진 뒤 자동',
};

export const nightModeDescriptions: Record<NightModeSetting, string> = {
  off: '달리는 화면을 늘 밝게 보여 줘요.',
  on: '달리는 화면을 늘 어둡게 보여 줘요. 다른 화면은 그대로예요.',
  auto: '해가 진 뒤에만 달리는 화면을 어둡게 해요.',
};

export function isNightModeSetting(value: unknown): value is NightModeSetting {
  return typeof value === 'string' && (nightModeSettings as readonly string[]).includes(value);
}

/** 시작을 누르고 몇 초를 세고 출발할지입니다. */
export const countdownChoices: readonly number[] = [3, 5, 10];

export type RunPreferences = {
  /** 자동 멈춤 단계입니다. */
  autoPause: AutoPauseLevel;
  /** 몸무게(kg). 넣지 않으면 칼로리를 아예 계산하지 않습니다. */
  weightKg?: number;
  /** 지금 기록을 언제 말해 줄지입니다. */
  liveStats: LiveStatsMode;
  /** 시간마다 말할 때의 간격(분)입니다. */
  liveStatsMinutes: number;
  nightMode: NightModeSetting;
  countdownSeconds: number;
};

export const defaultRunPreferences: RunPreferences = {
  autoPause: 'normal',
  liveStats: 'both',
  liveStatsMinutes: 5,
  nightMode: 'auto',
  countdownSeconds: 3,
};

function nearestChoice(value: unknown, choices: readonly number[], fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return choices.includes(value) ? value : fallback;
}

/** 저장소에서 읽은 값이 이상해도 앱이 멈추지 않도록 항상 쓸 수 있는 값으로 다듬습니다. */
export function sanitizeRunPreferences(value: Partial<RunPreferences> | null): RunPreferences {
  if (!value || typeof value !== 'object') return defaultRunPreferences;
  const weightKg = isValidWeightKg(value.weightKg)
    ? Math.round(value.weightKg * 10) / 10
    : undefined;
  return {
    autoPause: isAutoPauseLevel(value.autoPause) ? value.autoPause : defaultRunPreferences.autoPause,
    ...(weightKg === undefined ? {} : { weightKg }),
    liveStats: isLiveStatsMode(value.liveStats) ? value.liveStats : defaultRunPreferences.liveStats,
    liveStatsMinutes: nearestChoice(
      value.liveStatsMinutes,
      liveStatsIntervalChoices,
      defaultRunPreferences.liveStatsMinutes,
    ),
    nightMode: isNightModeSetting(value.nightMode)
      ? value.nightMode
      : defaultRunPreferences.nightMode,
    countdownSeconds: nearestChoice(
      value.countdownSeconds,
      countdownChoices,
      defaultRunPreferences.countdownSeconds,
    ),
  };
}

/** 몸무게 입력칸에 사람이 친 글자를 저장 가능한 값으로 바꿉니다. 이상하면 undefined입니다. */
export function parseWeightInput(text: string): number | undefined {
  const value = Number(text.replace(/[^0-9.]/g, ''));
  if (!isValidWeightKg(value)) return undefined;
  return Math.round(value * 10) / 10;
}

export const weightRangeNotice = `몸무게는 ${MIN_WEIGHT_KG}kg부터 ${MAX_WEIGHT_KG}kg 사이로 넣어 주세요.`;

type Listener = (preferences: RunPreferences) => void;

const listeners = new Set<Listener>();
let cached: RunPreferences | undefined;

/** 설정 화면에서 값을 바꾸면 달리기 화면도 바로 따라가도록 알려 줍니다. */
export function subscribeRunPreferences(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function loadRunPreferences(): Promise<RunPreferences> {
  if (cached) return cached;
  try {
    const raw = await AsyncStorage.getItem(RUN_PREFERENCES_KEY);
    cached = sanitizeRunPreferences(raw ? (JSON.parse(raw) as Partial<RunPreferences>) : null);
  } catch {
    cached = defaultRunPreferences;
  }
  return cached;
}

export async function saveRunPreferences(
  next: Partial<RunPreferences>,
): Promise<RunPreferences> {
  const current = await loadRunPreferences();
  // 몸무게는 지울 수도 있어야 하므로 undefined를 그대로 반영합니다.
  const merged = sanitizeRunPreferences({
    ...current,
    ...next,
    ...('weightKg' in next ? { weightKg: next.weightKg } : {}),
  });
  cached = merged;
  try {
    await AsyncStorage.setItem(RUN_PREFERENCES_KEY, JSON.stringify(merged));
  } catch {
    // 저장에 실패해도 이번 실행 동안에는 고른 값을 그대로 씁니다.
  }
  for (const listener of listeners) listener(merged);
  return merged;
}

/** 테스트와 기기 데이터 삭제에서만 씁니다. */
export function resetRunPreferencesCache(): void {
  cached = undefined;
}
