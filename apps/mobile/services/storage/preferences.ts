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
  interestedRaceIds: string[];
  interestedShoeIds: string[];
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
  interestedRaceIds: [],
  interestedShoeIds: [],
};

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
      coachMinutes: Math.min(120, Math.max(10, Number(value.coachMinutes) || 30)),
      ...(experienceLevel ? { experienceLevel } : { experienceLevel: undefined }),
      interestedRaceIds: Array.isArray(value.interestedRaceIds) ? value.interestedRaceIds : [],
      interestedShoeIds: Array.isArray(value.interestedShoeIds) ? value.interestedShoeIds : [],
    };
  } catch {
    return defaultPreferences;
  }
}

export async function savePreferences(preferences: AppPreferences): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(preferences));
}
