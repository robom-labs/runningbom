// 온보딩 완료 여부를 AsyncStorage에 읽고 씁니다. 판단 규칙은 status.ts가 갖고 있습니다.
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  ONBOARDING_KEY,
  emptyOnboardingStatus,
  parseOnboardingStatus,
  type OnboardingStatus,
} from './status';

export {
  ONBOARDING_KEY,
  emptyOnboardingStatus,
  looksLikeExistingUser,
  parseOnboardingStatus,
  resolveOnboardingStatus,
  type OnboardingStatus,
} from './status';

export async function loadOnboardingStatus(): Promise<OnboardingStatus> {
  try {
    const raw = await AsyncStorage.getItem(ONBOARDING_KEY);
    if (!raw) return emptyOnboardingStatus;
    return parseOnboardingStatus(JSON.parse(raw));
  } catch {
    // 읽기 실패는 "아직 안 봤다"로 두되, 저장이 되면 다음 실행부터 다시 뜨지 않습니다.
    return emptyOnboardingStatus;
  }
}

export async function saveOnboardingStatus(status: OnboardingStatus): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_KEY, JSON.stringify(status));
  } catch {
    // 저장 실패가 앱 사용을 막지 않도록 조용히 넘어갑니다.
  }
}
