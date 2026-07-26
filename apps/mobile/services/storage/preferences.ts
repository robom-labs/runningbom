// 러닝봄의 비민감 설정과 마지막 화면 상태를 AsyncStorage에 보존합니다.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'runningbom:vnext:preferences:v1';

export type AppPreferences = {
  coachMinutes: number;
  coachType: string;
  coachGuidance: 'minimal' | 'standard' | 'detailed';
  speechRate: number;
  lastTab: string;
  nickname: string;
  profileBio: string;
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

export async function loadPreferences(): Promise<AppPreferences> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return defaultPreferences;
    const value = JSON.parse(raw) as Partial<AppPreferences>;
    return {
      ...defaultPreferences,
      ...value,
      coachMinutes: Math.min(120, Math.max(10, Number(value.coachMinutes) || 30)),
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
