// 기기에 설치된 무료 TTS 음성 중 한국어 남성·여성 음성을 고르는 순수 휴리스틱입니다.
// 외부 유료 음성 API는 사용하지 않고 expo-speech가 열거해 주는 기기 음성만 다룹니다.
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

export type RankedVoice = {
  identifier: string;
  name: string;
  language: string;
  gender: VoiceGender | 'unknown';
  network: boolean;
  enhanced: boolean;
  score: number;
};

/**
 * 안드로이드 구글 TTS 한국어 음성 식별자별 성별 추정표입니다.
 * ko-kr-x-{koc,kod,ism,tia} 계열은 -local / -network 변형으로 함께 배포됩니다.
 */
const googleKoreanVoiceGender: Record<string, VoiceGender> = {
  'ko-kr-x-koc': 'female',
  'ko-kr-x-kod': 'male',
  'ko-kr-x-ism': 'female',
  'ko-kr-x-tia': 'male',
  'ko-kr-x-kob': 'male',
  'ko-kr-x-koa': 'female',
};

const femaleNameHints = [
  'female',
  'woman',
  '여성',
  '여자',
  'yuna',
  'sora',
  'jiyoung',
  'seoyeon',
  'heami',
  'sunhi',
];

const maleNameHints = [
  'male',
  'man',
  '남성',
  '남자',
  'minsu',
  'jinho',
  'gijae',
  'siwoo',
  'injoon',
];

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

export function classifyVoiceGender(voice: SpeechVoiceLike): VoiceGender | 'unknown' {
  const text = normalized(voice);
  for (const [key, gender] of Object.entries(googleKoreanVoiceGender)) {
    if (text.includes(key)) return gender;
  }
  // female 힌트를 먼저 보되 'male'이 'female'의 부분 문자열인 점을 피합니다.
  if (femaleNameHints.some((hint) => text.includes(hint))) return 'female';
  if (maleNameHints.some((hint) => text.includes(hint))) return 'male';
  // 구글 TTS는 같은 언어의 음성을 #1, #2 순으로 노출하기도 합니다.
  if (/#?\s?[13]\b/.test(text)) return 'female';
  if (/#?\s?[24]\b/.test(text)) return 'male';
  return 'unknown';
}

export function isNetworkVoice(voice: SpeechVoiceLike): boolean {
  return /network|online|cloud/.test(normalized(voice));
}

export function isEnhancedVoice(voice: SpeechVoiceLike): boolean {
  const text = normalized(voice);
  return (
    (voice.quality ?? '').toLowerCase() === 'enhanced' ||
    /enhanced|neural|premium|natural|siri|wavenet/.test(text)
  );
}

/** 품질 높은 음성(network·enhanced·neural 계열)이 앞에 오도록 점수를 매깁니다. */
export function scoreVoice(voice: SpeechVoiceLike, gender: VoiceGender): number {
  const detected = classifyVoiceGender(voice);
  let score = 0;
  if (detected === gender) score += 100;
  else if (detected === 'unknown') score += 20;
  if (isEnhancedVoice(voice)) score += 30;
  if (isNetworkVoice(voice)) score += 18;
  if (/-local/.test(normalized(voice))) score += 6;
  if (/compact/.test(normalized(voice))) score -= 6;
  return score;
}

export function rankKoreanVoices(
  voices: SpeechVoiceLike[],
  gender: VoiceGender,
): RankedVoice[] {
  return koreanVoices(voices)
    .map((voice) => ({
      identifier: voice.identifier,
      name: voice.name ?? voice.identifier,
      language: voice.language,
      gender: classifyVoiceGender(voice),
      network: isNetworkVoice(voice),
      enhanced: isEnhancedVoice(voice),
      score: scoreVoice(voice, gender),
    }))
    .sort((left, right) => right.score - left.score || left.identifier.localeCompare(right.identifier));
}

/** 남성/여성 중 하나를 고르면 그 안에서 가장 좋은 음성을 자동으로 선택합니다. */
export function selectVoiceIdentifier(
  voices: SpeechVoiceLike[],
  gender: VoiceGender,
): string | undefined {
  const ranked = rankKoreanVoices(voices, gender);
  return ranked.length > 0 ? ranked[0].identifier : undefined;
}

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
  const availability: VoiceAvailability = {
    hasKorean: korean.length > 0,
    hasMale: genders.includes('male'),
    hasFemale: genders.includes('female'),
    hasHighQuality: korean.some((voice) => isEnhancedVoice(voice) || isNetworkVoice(voice)),
  };

  if (!availability.hasKorean) {
    availability.notice =
      '이 기기에서 한국어 음성을 찾지 못했어요. 설정에서 "Google 음성 서비스"를 설치하고 한국어 음성을 내려받으면 더 자연스럽게 들려요. 지금은 기본 음성으로 안내할게요.';
  } else if (!availability.hasHighQuality) {
    availability.notice =
      '기기에 기본 품질 한국어 음성만 있어요. 음성 설정에서 고품질(네트워크) 한국어 음성을 내려받으면 더 자연스러워져요.';
  } else if (!availability.hasMale || !availability.hasFemale) {
    availability.notice =
      '한 가지 성별의 한국어 음성만 설치되어 있어요. 다른 성별을 쓰려면 기기 음성 설정에서 추가로 내려받을 수 있어요.';
  }
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

export const voiceGenderLabels: Record<VoiceGender, string> = {
  male: '남성',
  female: '여성',
};

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

export const voicePreviewText: Record<VoiceGender, string> = {
  male: '안녕하세요. 오늘도 옆에서 계속 안내할게요. 어깨 힘 빼고 편안하게 가 볼까요.',
  female: '안녕하세요. 오늘도 옆에서 계속 안내할게요. 어깨 힘 빼고 편안하게 가 볼까요.',
};
