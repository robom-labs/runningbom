// 저장된 코치 설정을 읽을 때 쓰는 정규화입니다. **순수합니다.**
//
// 왜 저장소와 분리되어 있는가:
//   저장소는 AsyncStorage를 씁니다. 그러면 Node에서 테스트할 수 없습니다.
//   그런데 정작 틀리기 쉬운 것은 저장이 아니라 **읽을 때의 판단**입니다.
//     - 저장된 게 없으면 예전 설정에서 옮겨 와야 하는가
//     - 모르는 값이면 무엇으로 되돌리는가
//     - 성인 확인이 풀렸는데 매운맛이 저장돼 있으면 어떻게 하는가
//   그 판단만 여기 떼어 놓고 테스트가 지키게 합니다.

import {
  DEFAULT_PERSONA_ID,
  bodyScanOrder,
  defaultCoachSettings,
  densityFromGuidanceLevel,
  findPersona,
  type BodyTheme,
  type CoachDensity,
  type CoachSettings,
  type SpeechRegister,
} from './persona';

const densities: CoachDensity[] = ['essential', 'balanced', 'close-coach', 'full-talk'];

function isDensity(value: unknown): value is CoachDensity {
  return typeof value === 'string' && densities.includes(value as CoachDensity);
}

function isRegister(value: unknown): value is SpeechRegister {
  return value === 'honorific' || value === 'casual';
}

function isBodyTheme(value: unknown): value is BodyTheme {
  return typeof value === 'string' && bodyScanOrder.includes(value as BodyTheme);
}

export type NormalizeInput = {
  /** 저장된 값입니다. 처음 켠 사람은 없습니다. */
  stored?: unknown;
  /**
   * V5까지 쓰던 안내 강도입니다.
   * **저장된 코치 설정이 없을 때만** 씁니다. 이미 골라 둔 것을 덮어쓰지 않습니다.
   */
  legacyGuidance?: string;
};

/**
 * 저장된 값을 쓸 수 있는 설정으로 만듭니다.
 *
 * 여기서 지키는 약속은 하나입니다 —
 * **사용자가 고른 것을 조용히 바꾸지 않습니다.**
 * 모르는 값이면 되돌리되, 아는 값은 그대로 둡니다.
 */
export function normalizeCoachSettings(input: NormalizeInput = {}): CoachSettings {
  const stored = (input.stored ?? undefined) as Partial<CoachSettings> | undefined;

  // 처음 켠 사람입니다. 예전에 골라 둔 안내 강도가 있으면 그 뜻을 이어받습니다.
  if (!stored || typeof stored !== 'object') {
    return {
      ...defaultCoachSettings,
      density: densityFromGuidanceLevel(input.legacyGuidance),
    };
  }

  const persona = findPersona(String(stored.personaId ?? ''));

  return {
    personaId: persona ? persona.id : DEFAULT_PERSONA_ID,
    register: isRegister(stored.register) ? stored.register : defaultCoachSettings.register,
    density: isDensity(stored.density)
      ? stored.density
      : densityFromGuidanceLevel(input.legacyGuidance),
    ...(isBodyTheme(stored.focusTheme) ? { focusTheme: stored.focusTheme } : {}),
    spicyEnabled: stored.spicyEnabled === true,
  };
}

/**
 * 실행 중에 바로 누를 수 있는 조절입니다.
 *
 * 달리는 중에 설정 화면까지 들어가게 하면 아무도 안 씁니다.
 * 그런데 말이 너무 많거나 너무 적다는 건 **달리는 중에만** 알 수 있습니다.
 */
export type QuickAdjust = 'quieter' | 'louder' | 'hush';

export const quickAdjustLabels: Record<QuickAdjust, string> = {
  quieter: '말 조금 줄이기',
  louder: '코치 더 세게',
  hush: '30초만 조용히',
};

/**
 * 밀도를 한 칸 올리거나 내립니다. 끝에서는 더 가지 않습니다.
 * '30초만 조용히'는 밀도를 바꾸지 않습니다 — 잠깐 쉬는 것이지 설정을 바꾸는 게 아닙니다.
 */
export function adjustDensity(density: CoachDensity, adjust: QuickAdjust): CoachDensity {
  const at = densities.indexOf(density);
  if (adjust === 'quieter') return densities[Math.max(0, at - 1)];
  if (adjust === 'louder') return densities[Math.min(densities.length - 1, at + 1)];
  return density;
}

/** '30초만 조용히'가 실제로 조용한 시간입니다. */
export const HUSH_SECONDS = 30;
