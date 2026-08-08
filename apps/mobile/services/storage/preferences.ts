// 러닝봄의 비민감 설정과 마지막 화면 상태를 AsyncStorage에 보존합니다.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { experienceLevels, isExperienceLevel, type ExperienceLevel } from '../../domains/badges/goals';

export type { ExperienceLevel };

// 저장 키는 바꾸지 않습니다. 새 필드는 같은 키 안에 더하기만 합니다(하위 호환).
const KEY = 'runningbom:vnext:preferences:v1';

export type AppPreferences = {
  coachMinutes: number;
  coachType: string;
  coachGuidance: 'minimal' | 'standard' | 'detailed';
  speechRate: number;
  lastTab: string;
  nickname: string;
  profileBio: string;
  /**
   * 사용자가 직접 고른 러닝 경력입니다. 주간 목표 추천의 "실력" 축으로만 씁니다.
   * 미설정(undefined)이 기본값이며, 예전에는 profileBio 접두어로 저장됐습니다.
   */
  experienceLevel?: ExperienceLevel;
  neighborhoodCode?: string;
  neighborhoodLabel?: string;
  leagueOptIn: boolean;
  featuredBadgeId?: string;
  currentShoeId?: string;
  /** 새 데이터에서 대표 종목 행이 바뀌어도 유지되는 대회 묶음 식별자입니다. */
  interestedRaceGroupKeys: string[];
  /** 0.19.1 이하에서 저장한 종목 행 ID입니다. 대회 화면 진입 시 묶음 키로 자동 이전합니다. */
  interestedRaceIds: string[];
  interestedShoeIds: string[];
  /**
   * "끝낼 때까지" 러닝을 골라 뒀는지입니다.
   * 없으면 예전처럼 시간을 정해 두고 뛰는 것으로 봅니다.
   */
  coachOpenEnded?: boolean;
};

export const defaultPreferences: AppPreferences = {
  coachMinutes: 30,
  coachType: '편안한 지속주',
  coachGuidance: 'standard',
  speechRate: 1,
  lastTab: '홈',
  nickname: '러너',
  profileBio: '',
  leagueOptIn: false,
  interestedRaceGroupKeys: [],
  interestedRaceIds: [],
  interestedShoeIds: [],
};

/**
 * 저장된 코칭 시간을 읽을 때 쓰는 범위입니다.
 *
 * 예전에는 여기서도 10분~120분으로 다시 잘랐습니다.
 * 그래서 150분을 골라 달린 사람이 앱을 다시 켜면 120분으로 바뀌어 있었습니다.
 * 고른 값이 어디에도 남지 않고 사라진 것입니다.
 *
 * 이제는 **저장이 깨졌을 때만** 막습니다. 하루(1440분)를 넘는 값은
 * 사람이 고른 값이 아니라 깨진 데이터로 봅니다.
 */
export const MIN_COACH_MINUTES = 1;
export const MAX_COACH_MINUTES = 24 * 60;

export function sanitizeCoachMinutes(value: unknown): number {
  const minutes = Math.round(Number(value));
  if (!Number.isFinite(minutes) || minutes < MIN_COACH_MINUTES) {
    return defaultPreferences.coachMinutes;
  }
  return Math.min(MAX_COACH_MINUTES, minutes);
}

/** 손상되거나 구버전인 저장 배열에서 비어 있지 않은 문자열만 중복 없이 복원합니다. */
export function sanitizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(
    (item): item is string => typeof item === 'string' && item.trim().length > 0,
  ))];
}

/**
 * 예전 프로필 화면은 러닝 경력을 profileBio 앞에 "1~3년 · ..." 형태로 붙여 저장했습니다.
 * 전용 필드가 비어 있을 때만 그 접두어를 읽어 옮깁니다(기존 소개 글은 그대로 둡니다).
 */
export function experienceFromLegacyBio(bio: string | undefined): ExperienceLevel | undefined {
  if (!bio) return undefined;
  return experienceLevels.find((level) => bio.startsWith(level));
}

/**
 * 전용 필드로 옮긴 뒤 소개 글 앞에 남은 경력 표시만 걷어냅니다.
 * 사용자가 직접 쓴 나머지 문장은 그대로 둡니다.
 */
export function stripLegacyExperiencePrefix(bio: string): string {
  const level = experienceFromLegacyBio(bio);
  if (!level) return bio;
  return bio.slice(level.length).replace(/^\s*·?\s*/u, '');
}

export function migrateExperienceLevel(value: Partial<AppPreferences>): ExperienceLevel | undefined {
  if (isExperienceLevel(value.experienceLevel)) return value.experienceLevel;
  return experienceFromLegacyBio(value.profileBio);
}

export async function loadPreferences(): Promise<AppPreferences> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return defaultPreferences;
    const value = JSON.parse(raw) as Partial<AppPreferences>;
    const experienceLevel = migrateExperienceLevel(value);
    return {
      ...defaultPreferences,
      ...value,
      coachMinutes: sanitizeCoachMinutes(value.coachMinutes),
      coachOpenEnded: value.coachOpenEnded === true,
      ...(experienceLevel ? { experienceLevel } : { experienceLevel: undefined }),
      interestedRaceGroupKeys: sanitizeStringList(value.interestedRaceGroupKeys),
      interestedRaceIds: sanitizeStringList(value.interestedRaceIds),
      interestedShoeIds: sanitizeStringList(value.interestedShoeIds),
    };
  } catch {
    return defaultPreferences;
  }
}

export async function savePreferences(preferences: AppPreferences): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(preferences));
}
