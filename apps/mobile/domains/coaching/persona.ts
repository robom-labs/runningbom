// 코치의 성격·말투·말의 밀도를 **서로 독립된 축**으로 나눕니다.
//
// 왜 축을 나누는가:
//   고정 모드 몇 개만 만들면 "엄격한데 존댓말"이나 "말 많은데 차분한"을 못 만듭니다.
//   사람마다 원하는 조합이 다릅니다. 그래서 성격·말투·밀도를 따로 고르게 합니다.
//
// V5.1과의 관계:
//   V5.1은 "음성을 줄이고 필요한 순간만 말한다"였습니다. 그건 **일반 안내에만** 남깁니다.
//   사용자가 밀착·풀토크를 고르면 코치는 거의 쉬지 않고 계속 말합니다.
//   두 방향이 충돌하는 게 아니라, **사용자가 고르는 것**이 됩니다.
//
// 이 파일은 순수합니다.

// ── 말투 ────────────────────────────────────────────────────────────────────

export type SpeechRegister = 'honorific' | 'casual';

export const registerLabels: Record<SpeechRegister, string> = {
  honorific: '존댓말',
  casual: '반말',
};

export const registerExamples: Record<SpeechRegister, string> = {
  honorific: '어깨가 올라갔으면 지금 내려 주세요. 손에도 힘을 빼세요.',
  casual: '어깨 올라갔으면 지금 내려. 손에도 힘 빼.',
};

// ── 말의 밀도 ───────────────────────────────────────────────────────────────

export type CoachDensity = 'essential' | 'balanced' | 'close-coach' | 'full-talk';

export const densityLabels: Record<CoachDensity, string> = {
  essential: '꼭 필요한 것만',
  balanced: '보통',
  'close-coach': '옆에서 자주',
  'full-talk': '거의 쉬지 않고',
};

export const densityDescriptions: Record<CoachDensity, string> = {
  essential: '시작·구간 전환·마무리처럼 꼭 필요한 것만 말해요.',
  balanced: '자세와 리듬을 가끔 짚어 줘요.',
  'close-coach': '옆에서 함께 뛰는 코치처럼 자주 말해요.',
  'full-talk': '거의 쉬지 않고 계속 말해요. 혼자 뛰는 느낌이 싫을 때 좋아요.',
};

/**
 * 밀도별로 **말이 차지하는 비율**입니다(0~1).
 *
 * 간격이 아니라 점유율로 잡는 이유:
 *   간격으로 잡으면 문장이 길어질수록 실제로는 더 조용해집니다.
 *   "얼마나 자주 말하는가"가 아니라 "얼마나 말하고 있는가"가 사용자가 느끼는 것입니다.
 */
export const densitySpeechOccupancy: Record<CoachDensity, { min: number; max: number }> = {
  essential: { min: 0.05, max: 0.2 },
  balanced: { min: 0.2, max: 0.45 },
  'close-coach': { min: 0.45, max: 0.75 },
  'full-talk': { min: 0.75, max: 0.95 },
};

/**
 * 의도하지 않은 침묵의 상한(초)입니다.
 *
 * **의도한 쉼과 다릅니다.** 숨 쉬는 간격, 문장 사이 여백은 정상입니다.
 * 여기서 말하는 건 "다음에 할 말을 준비 못 해서 비는 시간"입니다.
 */
export const densityMaxUnintendedSilence: Record<CoachDensity, number> = {
  essential: 90,
  balanced: 40,
  'close-coach': 12,
  'full-talk': 6,
};

// ── 코치 성격 ───────────────────────────────────────────────────────────────

export type PersonaId =
  | 'professional'
  | 'running-buddy'
  | 'form-nag'
  | 'drill-sergeant'
  | 'spicy-drill'
  | 'audiobook-narrator'
  | 'mental-pacer';

export type CoachPersona = {
  id: PersonaId;
  name: string;
  /** 고를 때 보이는 한 줄입니다. */
  summary: string;
  /** 기본 말투입니다. 사용자가 바꿀 수 있습니다. */
  defaultRegister: SpeechRegister;
  /** 기본 밀도입니다. */
  defaultDensity: CoachDensity;
  /** 실제로 이 코치가 어떻게 말하는지 들려 주는 예문입니다. */
  sample: { honorific: string; casual: string };
  /**
   * 성인 확인이 필요한지입니다.
   * true면 기본 OFF이고, 명시적으로 켜야 하며, Production 공개 전 검토가 필요합니다.
   */
  adultOnly?: boolean;
};

/**
 * 실존 인물·캐릭터를 흉내 내지 않습니다.
 * 이름도 성격도 우리가 만든 것입니다. 특정 유튜버·연예인·애니 캐릭터를 연상시키지 않습니다.
 */
export const coachPersonas: CoachPersona[] = [
  {
    id: 'professional',
    name: '정석 코치',
    summary: '차분하고 정확하게. 왜 그런지 짧게 설명해요.',
    defaultRegister: 'honorific',
    defaultDensity: 'balanced',
    sample: {
      honorific: '정수리는 위로 길게, 턱은 살짝만 당기세요. 어깨는 귀에서 멀어지게 내려놓습니다.',
      casual: '정수리 위로 길게, 턱은 살짝만 당겨. 어깨는 귀에서 멀어지게 내려.',
    },
  },
  {
    id: 'running-buddy',
    name: '옆자리 러닝메이트',
    summary: '친한 사람처럼. 장난도 치고 현실적으로 격려해요.',
    defaultRegister: 'casual',
    defaultDensity: 'close-coach',
    sample: {
      honorific: '어깨에 힘 또 들어가려 하죠? 툭 내려놓으세요. 손도 가볍게. 지금 리듬 좋습니다.',
      casual: '어깨 힘 또 들어가려 하지? 툭 내려. 손도 가볍게. 지금 리듬 괜찮아.',
    },
  },
  {
    id: 'form-nag',
    name: '잔소리 폼 코치',
    summary: '자세를 자주 다시 확인해요. 짧게 자꾸 짚어 줘요.',
    defaultRegister: 'casual',
    defaultDensity: 'close-coach',
    sample: {
      honorific: '허리 꺾지 마세요. 키는 길게. 발은 몸 아래. 손에 힘 빼고 다시 갑니다.',
      casual: '허리 꺾지 마. 키는 길게. 발은 몸 아래. 손에 힘 빼고 다시 가.',
    },
  },
  {
    id: 'drill-sergeant',
    name: '단호한 교관',
    summary: '강하게 밀어붙여요. 다만 아프면 바로 강도를 낮춰요.',
    defaultRegister: 'casual',
    defaultDensity: 'close-coach',
    sample: {
      honorific: '대충 뛰지 마세요. 속도는 낮춰도 됩니다. 자세까지 던지지는 마세요.',
      casual: '대충 뛰지 마. 속도는 낮춰도 돼. 그런데 자세까지 던지진 마.',
    },
  },
  {
    id: 'spicy-drill',
    name: '매운맛 교관',
    summary: '거친 말이 섞여요. 성인 확인이 필요하고 기본은 꺼져 있어요.',
    defaultRegister: 'casual',
    defaultDensity: 'full-talk',
    adultOnly: true,
    sample: {
      honorific: '정신 차리세요. 지금 속도 말고 자세부터 다시 잡습니다.',
      casual: '정신 차려. 지금 속도 말고 자세부터 다시 잡아.',
    },
  },
  {
    id: 'audiobook-narrator',
    name: '이야기 코치',
    summary: '긴 이야기처럼 이어서 말해요. 지루한 장거리에 좋아요.',
    defaultRegister: 'honorific',
    defaultDensity: 'full-talk',
    sample: {
      honorific:
        '달리기에서 힘을 뺀다는 건 축 늘어지는 게 아니라, 필요 없는 곳에만 힘을 빼는 일입니다. 지금 손끝부터 한번 살펴볼까요.',
      casual:
        '힘을 뺀다는 게 축 늘어지라는 말은 아니야. 필요 없는 데만 빼는 거지. 손끝부터 한번 보자.',
    },
  },
  {
    id: 'mental-pacer',
    name: '멘탈 페이서',
    summary: '지루함과 포기하고 싶은 마음을 같이 다뤄요.',
    defaultRegister: 'honorific',
    defaultDensity: 'balanced',
    sample: {
      honorific: '지금은 끝까지를 생각하지 마세요. 다음 한 구간만 봅니다. 숨부터 고르게 만들어요.',
      casual: '지금 끝까지 생각하지 마. 다음 한 구간만 봐. 숨부터 고르게 만들자.',
    },
  },
];

export function findPersona(id: string): CoachPersona | undefined {
  return coachPersonas.find((persona) => persona.id === id);
}

/** 기본으로 보여 줄 코치입니다. 매운맛은 절대 기본이 아닙니다. */
export const DEFAULT_PERSONA_ID: PersonaId = 'professional';

/** 성인 확인 없이 고를 수 있는 코치입니다. */
export function publicPersonas(): CoachPersona[] {
  return coachPersonas.filter((persona) => !persona.adultOnly);
}

// ── 집중 주제 ───────────────────────────────────────────────────────────────

export type BodyTheme =
  | 'whole'
  | 'head'
  | 'shoulders'
  | 'arms'
  | 'torso'
  | 'hips'
  | 'legs'
  | 'feet'
  | 'cadence'
  | 'breathing'
  | 'relax'
  | 'mindset';

export const bodyThemeLabels: Record<BodyTheme, string> = {
  whole: '전신',
  head: '머리·시선',
  shoulders: '목·어깨',
  arms: '팔·손',
  torso: '몸통·갈비뼈',
  hips: '골반',
  legs: '엉덩이·무릎',
  feet: '발목·발',
  cadence: '박자·보폭',
  breathing: '호흡',
  relax: '힘 빼기',
  mindset: '마음가짐',
};

/**
 * 머리부터 발끝까지 도는 순서입니다.
 *
 * **한 번에 한 곳만** 의식하게 합니다. 계속 말한다고 매 문장마다 부위를 바꾸면
 * 사용자는 뭘 해야 할지 몰라 오히려 몸이 굳습니다.
 */
export const bodyScanOrder: BodyTheme[] = [
  'head',
  'shoulders',
  'arms',
  'torso',
  'hips',
  'legs',
  'feet',
  'cadence',
  'breathing',
  'whole',
];

/** 지금 커서에서 다음 주제로 넘어갑니다. 끝까지 가면 전신 리셋 뒤 처음으로 돌아옵니다. */
export function nextBodyTheme(cursor: number): { theme: BodyTheme; cursor: number } {
  const next = (cursor + 1) % bodyScanOrder.length;
  return { theme: bodyScanOrder[next] as BodyTheme, cursor: next };
}

// ── 설정 묶음 ───────────────────────────────────────────────────────────────

export type CoachSettings = {
  personaId: PersonaId;
  register: SpeechRegister;
  density: CoachDensity;
  /** 오늘 특별히 챙기고 싶은 주제입니다. 없으면 전신을 순서대로 돕니다. */
  focusTheme?: BodyTheme;
  /** 매운맛을 켰는지입니다. 성인 확인을 통과해야만 true가 될 수 있습니다. */
  spicyEnabled: boolean;
  /**
   * 자세 커리큘럼을 어디까지 들었는지입니다.
   *
   * 이게 없으면 매 러닝이 "머리부터"로 시작합니다.
   * 20분씩 뛰는 사람은 머리·어깨·팔까지만 듣고, 몇 달을 달려도 발 이야기는 못 듣습니다.
   */
  bodyCursor?: number;
};

export const defaultCoachSettings: CoachSettings = {
  personaId: DEFAULT_PERSONA_ID,
  register: 'honorific',
  density: 'balanced',
  spicyEnabled: false,
};

/**
 * V5까지 쓰던 `minimal | standard | detailed`를 새 밀도로 옮깁니다.
 *
 * 기존 사용자의 설정이 조용히 바뀌면 안 됩니다.
 * 저장된 값이 없거나 모르는 값이면 가장 무난한 쪽으로 갑니다.
 */
export function densityFromGuidanceLevel(level: string | undefined): CoachDensity {
  if (level === 'minimal') return 'essential';
  if (level === 'detailed') return 'close-coach';
  return 'balanced';
}

/**
 * 새 밀도를 코칭 엔진이 아는 안내 강도로 되돌립니다.
 *
 * 엔진은 아직 `minimal | standard | detailed` 셋만 압니다.
 * 풀토크는 지금 가장 촘촘한 쪽에 붙여 둡니다 — **말수는 늘지만 아직 "쉼 없이"는 아닙니다.**
 * 그 차이를 없애는 것이 다음 단계(대화 상태 엔진)의 일입니다.
 */
export function guidanceLevelFromDensity(density: CoachDensity): 'minimal' | 'standard' | 'detailed' {
  if (density === 'essential') return 'minimal';
  if (density === 'balanced') return 'standard';
  return 'detailed';
}

/**
 * 매운맛을 실제로 쓸 수 있는지입니다.
 *
 * 성격만 골랐다고 켜지지 않습니다. **성인 확인과 설정이 둘 다** 있어야 합니다.
 * 하나라도 없으면 순한 교관으로 내려갑니다.
 */
export function resolvePersona(settings: CoachSettings, adultConfirmed: boolean): CoachPersona {
  const wanted = findPersona(settings.personaId) ?? (findPersona(DEFAULT_PERSONA_ID) as CoachPersona);
  if (!wanted.adultOnly) return wanted;
  if (adultConfirmed && settings.spicyEnabled) return wanted;
  return findPersona('drill-sergeant') as CoachPersona;
}
