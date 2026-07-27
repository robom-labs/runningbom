// 기기에 설치된 무료 음성 중에서 가장 자연스러운 한국어 목소리를 고르는 순수 휴리스틱입니다.
// 외부 유료 음성 API는 쓰지 않고 expo-speech가 열거해 주는 기기 음성만 다룹니다.
//
// 왜 순위 규칙을 다시 짰나:
// 1) 안드로이드에서 가장 사람 같은 한국어는 구글 음성의 "인터넷 음성"(-network)입니다.
//    구글 쪽은 딥러닝 기반 합성이라 억양이 살아 있고, 기기 기본·삼성 음성은 상대적으로 밋밋합니다.
// 2) 예전 규칙은 ko-kr-x-koc/kod/ism/tia 같은 식별자를 보고 남성·여성을 "추측"했습니다.
//    이 추측이 틀리면 여성으로 골랐는데 남성이 나오는 식이라, 듣는 사람은 그걸 "어색함"으로 느낍니다.
//    그래서 지금은 식별자에 성별이 명시(#female_1 / #male_2)되었을 때만 성별을 말하고,
//    확실하지 않으면 "기기 음성 1/2/3" 같은 중립 이름으로 보여 주고 직접 들어보고 고르게 합니다.
import type { GuidanceLevel } from './model';
import type { RunningTypeId } from './sessionTypes';

export type VoiceGender = 'male' | 'female';

/** expo-speech의 Voice와 호환되는 최소 형태입니다(테스트 가능하도록 좁혔습니다). */
export type SpeechVoiceLike = {
  identifier: string;
  name?: string;
  language: string;
  quality?: string;
};

/**
 * 목소리의 자연스러움 등급입니다. 숫자가 클수록 사람 목소리에 가깝습니다.
 * - onlineNatural: 구글 인터넷 음성. 가장 자연스럽지만 데이터가 필요합니다.
 * - offlineNatural: 구글이 내려받아 둔 한국어 음성. 인터넷 없이도 꽤 자연스럽습니다.
 * - enhanced: 다른 제조사가 "고품질"이라고 표시한 음성입니다.
 * - basic: 기기에 기본으로 들어 있는 평범한 음성입니다.
 * - lowQuality: 용량을 줄인 압축 음성입니다. 가장 기계 같습니다.
 */
export type VoiceTier = 'onlineNatural' | 'offlineNatural' | 'enhanced' | 'basic' | 'lowQuality';

export const voiceTierOrder: VoiceTier[] = [
  'onlineNatural',
  'offlineNatural',
  'enhanced',
  'basic',
  'lowQuality',
];

const tierScore: Record<VoiceTier, number> = {
  onlineNatural: 100,
  offlineNatural: 80,
  enhanced: 62,
  basic: 40,
  lowQuality: 16,
};

/** 사용자에게 보여 줄 등급 설명입니다. "음성 엔진", "신경망" 같은 말은 쓰지 않습니다. */
export const voiceTierLabels: Record<VoiceTier, string> = {
  onlineNatural: '가장 자연스러운 목소리',
  offlineNatural: '자연스러운 목소리',
  enhanced: '또렷한 목소리',
  basic: '기본 목소리',
  lowQuality: '가벼운 기본 목소리',
};

export const voiceTierNotes: Record<VoiceTier, string> = {
  onlineNatural: '인터넷이 연결돼 있을 때 가장 사람처럼 들려요.',
  offlineNatural: '내려받아 둔 목소리라 인터넷 없이도 잘 들려요.',
  enhanced: '기기에서 고품질로 표시한 목소리예요.',
  basic: '기기에 원래 들어 있던 목소리예요.',
  lowQuality: '용량을 줄인 목소리라 조금 기계처럼 들릴 수 있어요.',
};

export type RankedVoice = {
  identifier: string;
  name: string;
  language: string;
  gender: VoiceGender | 'unknown';
  network: boolean;
  enhanced: boolean;
  tier: VoiceTier;
  /** 화면에 그대로 쓸 수 있는 이름입니다. 성별이 확실하지 않으면 "기기 음성 2"처럼 중립으로 붙습니다. */
  label: string;
  /** 라벨 아래 한 줄 설명입니다. */
  note: string;
  score: number;
};

function normalized(voice: SpeechVoiceLike): string {
  return `${voice.identifier} ${voice.name ?? ''}`.toLowerCase();
}

export function isKoreanVoice(voice: SpeechVoiceLike): boolean {
  const language = (voice.language ?? '').toLowerCase().replace('_', '-');
  return language.startsWith('ko');
}

export function koreanVoices(voices: SpeechVoiceLike[]): SpeechVoiceLike[] {
  return voices.filter(isKoreanVoice);
}

/**
 * 구글 음성 서비스가 만든 목소리인지 봅니다.
 * 구글은 `ko-kr-x-ism-local`처럼 언어 코드 뒤에 `-x-`를 넣는 이름 규칙을 씁니다.
 */
export function isGoogleVoice(voice: SpeechVoiceLike): boolean {
  const text = normalized(voice);
  return /(^|[^a-z])[a-z]{2}-[a-z]{2}-x-/.test(text) || text.includes('com.google.android.tts');
}

export function isNetworkVoice(voice: SpeechVoiceLike): boolean {
  return /-network\b|network|online|cloud/.test(normalized(voice));
}

export function isEnhancedVoice(voice: SpeechVoiceLike): boolean {
  const text = normalized(voice);
  return (
    (voice.quality ?? '').toLowerCase() === 'enhanced' ||
    /enhanced|neural|premium|natural|wavenet|very[-_ ]?high/.test(text)
  );
}

function isLowQualityVoice(voice: SpeechVoiceLike): boolean {
  const text = normalized(voice);
  if (isEnhancedVoice(voice)) return false;
  return /compact|low[-_ ]?quality|lite\b/.test(text);
}

/** 목소리의 자연스러움 등급을 매깁니다. 구글 인터넷 음성이 최우선입니다. */
export function voiceTier(voice: SpeechVoiceLike): VoiceTier {
  const google = isGoogleVoice(voice);
  if (google && isNetworkVoice(voice)) return 'onlineNatural';
  if (google) return 'offlineNatural';
  if (isNetworkVoice(voice)) return 'enhanced';
  if (isEnhancedVoice(voice)) return 'enhanced';
  if (isLowQualityVoice(voice)) return 'lowQuality';
  return 'basic';
}

/**
 * 식별자에 성별이 "명시"되어 있을 때만 성별을 말합니다.
 * 구글 음성은 `ko-kr-x-ism#female_1-local`처럼 `#female` / `#male`을 붙여 줍니다.
 * `ko-kr-x-kod-network`처럼 표시가 없으면 추측하지 않고 unknown을 돌려줍니다.
 * (틀린 성별 표기는 "고른 목소리와 다른 목소리가 나온다"는 어색함으로 이어집니다.)
 */
export function classifyVoiceGender(voice: SpeechVoiceLike): VoiceGender | 'unknown' {
  const text = normalized(voice);
  // 'female'이 'male'을 품고 있으므로 여성부터 확인합니다.
  if (/#\s*female|(^|[^a-z])female|여성|여자/.test(text)) return 'female';
  if (/#\s*male|(^|[^a-z])male|남성|남자/.test(text)) return 'male';
  // 애플이 붙인 사람 이름 음성은 이름 자체가 성별을 알려 줍니다.
  if (/(yuna|sora|jiyoung|seoyeon|heami|sunhi)/.test(text)) return 'female';
  if (/(minsu|jinho|gijae|siwoo|injoon)/.test(text)) return 'male';
  return 'unknown';
}

export const voiceGenderLabels: Record<VoiceGender, string> = {
  male: '남성',
  female: '여성',
};

/**
 * 점수를 매깁니다. 자연스러움(등급)이 1순위, 원하는 성별이 2순위입니다.
 * 성별을 알 수 없는 목소리는 감점하지 않습니다. 모르는 것은 모른다고 두고 사용자가 고르게 합니다.
 */
export function scoreVoice(voice: SpeechVoiceLike, gender?: VoiceGender): number {
  let score = tierScore[voiceTier(voice)];
  if (gender) {
    const detected = classifyVoiceGender(voice);
    if (detected === gender) score += 12;
    else if (detected !== 'unknown') score -= 8;
  }
  return score;
}

/** 성별을 모르는 목소리에 붙일 중립 이름을 만듭니다. */
function neutralLabel(index: number): string {
  return `기기 음성 ${index}`;
}

/**
 * 화면에 그대로 쓸 수 있는 형태로 한국어 목소리를 정리합니다.
 * gender를 주면 그 성별을 조금 앞으로 당기지만, 자연스러움이 항상 먼저입니다.
 */
export function rankKoreanVoices(
  voices: SpeechVoiceLike[],
  gender?: VoiceGender,
): RankedVoice[] {
  const ranked = koreanVoices(voices)
    .map((voice) => {
      const tier = voiceTier(voice);
      return {
        identifier: voice.identifier,
        name: voice.name ?? voice.identifier,
        language: voice.language,
        gender: classifyVoiceGender(voice),
        network: isNetworkVoice(voice),
        enhanced: isEnhancedVoice(voice),
        tier,
        label: '',
        note: voiceTierNotes[tier],
        score: scoreVoice(voice, gender),
      } satisfies RankedVoice;
    })
    .sort(
      (left, right) =>
        right.score - left.score || left.identifier.localeCompare(right.identifier),
    );

  // 이름표는 정렬이 끝난 뒤에 붙입니다. 목록에 보이는 순서대로 1, 2, 3이 되도록요.
  let neutralIndex = 0;
  return ranked.map((voice) => {
    if (voice.gender === 'unknown') {
      neutralIndex += 1;
      return { ...voice, label: neutralLabel(neutralIndex) };
    }
    return { ...voice, label: `${voiceGenderLabels[voice.gender]} 목소리` };
  });
}

/**
 * 실제로 쓸 목소리를 하나 고릅니다.
 * 사용자가 "음성 고르기"에서 직접 고른 목소리가 있으면 그게 무조건 이깁니다.
 */
export function selectVoiceIdentifier(
  voices: SpeechVoiceLike[],
  gender?: VoiceGender,
  preferredIdentifier?: string,
): string | undefined {
  const ranked = rankKoreanVoices(voices, gender);
  if (preferredIdentifier) {
    const chosen = ranked.find((voice) => voice.identifier === preferredIdentifier);
    if (chosen) return chosen.identifier;
  }
  return ranked.length > 0 ? ranked[0].identifier : undefined;
}

/**
 * 기기 목소리 상태 진단입니다. 화면 맨 위에 그대로 띄울 수 있습니다.
 * - none: 한국어 목소리가 아예 없습니다.
 * - basicOnly: 기본 목소리만 있습니다. 더 자연스러운 목소리를 받을 수 있다고 알려 줘야 합니다.
 * - good: 자연스러운 목소리가 이미 깔려 있습니다.
 */
export type VoiceQualityLevel = 'none' | 'basicOnly' | 'good';

export type VoiceQualityReport = {
  level: VoiceQualityLevel;
  /** 굵게 보여 줄 한 줄입니다. */
  headline: string;
  /** 그 아래 설명입니다. */
  detail: string;
  /** 설치 안내 카드를 띄워야 하는지입니다. */
  suggestInstall: boolean;
  koreanCount: number;
  bestTier?: VoiceTier;
};

export function koreanVoiceQuality(voices: SpeechVoiceLike[]): VoiceQualityReport {
  const korean = koreanVoices(voices);
  if (korean.length === 0) {
    return {
      level: 'none',
      headline: '한국어 목소리를 찾지 못했어요',
      detail:
        '이 기기에서 한국어로 말해 줄 목소리를 찾지 못했어요. 아래 순서대로 목소리를 받으면 코치가 말하기 시작해요.',
      suggestInstall: true,
      koreanCount: 0,
    };
  }

  const tiers = korean.map(voiceTier);
  const bestTier =
    voiceTierOrder.find((tier) => tiers.includes(tier)) ?? ('basic' as VoiceTier);

  if (bestTier === 'onlineNatural' || bestTier === 'offlineNatural') {
    return {
      level: 'good',
      headline: '자연스러운 목소리가 준비돼 있어요',
      detail:
        '사람이 말하는 것에 가까운 한국어 목소리가 이미 깔려 있어요. 아래에서 들어 보고 마음에 드는 목소리를 고르세요.',
      suggestInstall: false,
      koreanCount: korean.length,
      bestTier,
    };
  }

  return {
    level: 'basicOnly',
    headline: '기본 목소리만 있어요',
    detail:
      '지금은 기기에 원래 있던 목소리로 말해요. 더 자연스러운 목소리를 무료로 받을 수 있어요.',
    suggestInstall: true,
    koreanCount: korean.length,
    bestTier,
  };
}

/** 안내 카드에 번호대로 적을 설치 순서입니다. 화면은 이 배열을 그대로 그립니다. */
export const voiceInstallSteps: string[] = [
  '플레이 스토어에서 "Google 음성 서비스"를 찾아 설치하거나 업데이트해요.',
  '휴대폰 설정에서 "음성으로 읽어 주기"를 열어요. 아래 버튼을 누르면 바로 열려요.',
  '읽어 줄 목소리를 "Google 음성 서비스"로 바꿔요.',
  '그 옆의 톱니바퀴를 눌러 "음성 데이터 설치"에서 한국어를 골라 내려받아요.',
  '한국어 목록에서 이름 뒤에 "자연스러움" 또는 별표가 붙은 목소리를 받으면 가장 사람처럼 들려요.',
  '러닝봄으로 돌아와 "목소리 다시 찾기"를 누르고, 아래에서 들어 보고 골라요.',
];

/** 안드로이드 음성 설정으로 보내는 인텐트 이름입니다(열리지 않으면 앱 설정으로 폴백합니다). */
export const androidVoiceSettingsIntent = 'com.android.settings.TTS_SETTINGS';

export type VoiceAvailability = {
  hasKorean: boolean;
  hasMale: boolean;
  hasFemale: boolean;
  hasHighQuality: boolean;
  /** 사용자가 스스로 판단할 수 있게 정직하게 안내하는 문구입니다(강제 아님). */
  notice?: string;
};

export function koreanVoiceAvailability(voices: SpeechVoiceLike[]): VoiceAvailability {
  const korean = koreanVoices(voices);
  const genders = korean.map(classifyVoiceGender);
  const report = koreanVoiceQuality(voices);
  const availability: VoiceAvailability = {
    hasKorean: korean.length > 0,
    hasMale: genders.includes('male'),
    hasFemale: genders.includes('female'),
    hasHighQuality: report.level === 'good',
  };
  if (report.level !== 'good') availability.notice = `${report.headline}. ${report.detail}`;
  return availability;
}

export type VoiceTuning = { pitch: number; rate: number };

const genderBase: Record<VoiceGender, VoiceTuning> = {
  male: { pitch: 0.95, rate: 1 },
  female: { pitch: 1.04, rate: 1 },
};

/** 유형이 강할수록 조금 또렷하고 빠르게, 회복 계열은 낮고 느리게 다듬습니다. */
const typeTuning: Partial<Record<RunningTypeId, VoiceTuning>> = {
  interval: { pitch: 0.06, rate: 0.1 },
  hill: { pitch: 0.05, rate: 0.08 },
  strides: { pitch: 0.05, rate: 0.08 },
  tempo: { pitch: 0.03, rate: 0.06 },
  fartlek: { pitch: 0.03, rate: 0.05 },
  progression: { pitch: 0.02, rate: 0.04 },
  long: { pitch: -0.02, rate: -0.03 },
  recoveryWalk: { pitch: -0.04, rate: -0.07 },
  mobility: { pitch: -0.05, rate: -0.08 },
  wakeup: { pitch: -0.03, rate: -0.06 },
  walk: { pitch: -0.03, rate: -0.05 },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number(value.toFixed(2))));
}

export function voiceTuning(
  typeId: RunningTypeId,
  gender: VoiceGender,
  guidance: GuidanceLevel = 'standard',
  userRate = 1,
): VoiceTuning {
  const base = genderBase[gender];
  const offset = typeTuning[typeId] ?? { pitch: 0, rate: 0 };
  // 자세히 안내는 멘트가 촘촘해 살짝 빠르게, 간단 안내는 여유 있게 읽습니다.
  const densityRate = guidance === 'detailed' ? 0.05 : guidance === 'minimal' ? -0.03 : 0;
  return {
    pitch: clamp(base.pitch + offset.pitch, 0.8, 1.3),
    rate: clamp((base.rate + offset.rate + densityRate) * userRate, 0.7, 1.3),
  };
}

/** 음성 고르기 화면에서 쓰는 빠르기·높낮이 범위입니다. */
export const voiceRateRange = { min: 0.7, max: 1.3, step: 0.05, default: 1 } as const;
export const voicePitchRange = { min: 0.8, max: 1.2, step: 0.05, default: 1 } as const;

export type CoachVoicePreference = {
  gender: VoiceGender;
};

export const defaultCoachVoicePreference: CoachVoicePreference = {
  gender: 'female',
};

/** 저장된 값이 손상되었거나 예전 형식이어도 안전한 선택값으로 되돌립니다. */
export function normalizeVoicePreference(value: unknown): CoachVoicePreference {
  if (value && typeof value === 'object') {
    const gender = (value as Partial<CoachVoicePreference>).gender;
    if (gender === 'male' || gender === 'female') return { gender };
  }
  return defaultCoachVoicePreference;
}

/**
 * "음성 고르기" 화면에서 직접 고른 목소리입니다.
 * 기존 남성·여성 선택값(CoachVoicePreference)과는 따로 보관해서 서로 덮어쓰지 않습니다.
 */
export type CoachVoicePick = {
  /** 고른 목소리의 식별자입니다. 비어 있으면 "알아서 골라 줘"라는 뜻입니다. */
  identifier?: string;
  rate: number;
  pitch: number;
};

export const defaultCoachVoicePick: CoachVoicePick = {
  rate: voiceRateRange.default,
  pitch: voicePitchRange.default,
};

function clampToRange(
  value: unknown,
  range: { min: number; max: number; default: number },
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return range.default;
  return clamp(value, range.min, range.max);
}

/** 저장된 값이 손상되었거나 예전 형식이어도 안전한 값으로 되돌립니다. */
export function normalizeVoicePick(value: unknown): CoachVoicePick {
  if (!value || typeof value !== 'object') return defaultCoachVoicePick;
  const raw = value as Partial<CoachVoicePick>;
  const identifier =
    typeof raw.identifier === 'string' && raw.identifier.trim().length > 0
      ? raw.identifier.trim()
      : undefined;
  return {
    ...(identifier ? { identifier } : {}),
    rate: clampToRange(raw.rate, voiceRateRange),
    pitch: clampToRange(raw.pitch, voicePitchRange),
  };
}

/**
 * 고른 목소리가 아직 기기에 있는지 확인합니다.
 * 사용자가 그 목소리를 지웠으면 저장값을 비워서 "알아서 고르기"로 돌아가게 합니다.
 */
export function reconcileVoicePick(
  pick: CoachVoicePick,
  voices: SpeechVoiceLike[],
): CoachVoicePick {
  if (!pick.identifier) return pick;
  const exists = koreanVoices(voices).some((voice) => voice.identifier === pick.identifier);
  if (exists) return pick;
  const { identifier: _dropped, ...rest } = pick;
  return rest;
}

/** 미리듣기 문장입니다. 실제 코치가 달리는 중에 할 법한 말로 씁니다. */
export const voicePreviewSentence =
  '지금 페이스 좋아요. 어깨 힘 빼고, 이대로 가요.';

export const voicePreviewText: Record<VoiceGender, string> = {
  male: voicePreviewSentence,
  female: voicePreviewSentence,
};
