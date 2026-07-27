// 체험 모드로 만든 프로필을 이 기기에만 저장합니다. 새 키만 쓰고 기존 키는 건드리지 않습니다.
// 네트워크로 보내는 곳은 어디에도 없습니다.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { TRIAL_PROFILE_KEY, isTrialProfile, type TrialProfile } from './trialLogin';

export async function loadTrialProfile(): Promise<TrialProfile | undefined> {
  try {
    const raw = await AsyncStorage.getItem(TRIAL_PROFILE_KEY);
    if (!raw) return undefined;
    const parsed: unknown = JSON.parse(raw);
    return isTrialProfile(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export async function saveTrialProfile(profile: TrialProfile): Promise<void> {
  try {
    await AsyncStorage.setItem(TRIAL_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // 저장에 실패해도 이번 실행 중에는 화면에 그대로 보입니다.
  }
}

export async function clearTrialProfile(): Promise<void> {
  try {
    await AsyncStorage.removeItem(TRIAL_PROFILE_KEY);
  } catch {
    // 지우지 못해도 앱 사용을 막지 않습니다.
  }
}
