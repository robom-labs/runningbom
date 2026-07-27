// "음성 고르기" 화면에서 직접 고른 목소리를 따로 보관합니다.
// 기존 설정 저장소(preferences)와 코치 음성 성별 저장소는 건드리지 않고 새 키만 씁니다.
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  defaultCoachVoicePick,
  normalizeVoicePick,
  type CoachVoicePick,
} from '../../../domains/coaching/voice';

/** 새로 만든 전용 키입니다. 기존 키를 덮어쓰지 않습니다. */
export const coachVoicePickKey = 'runningbom:coaching:voice-pick:v1';

export { defaultCoachVoicePick, normalizeVoicePick, type CoachVoicePick };

export async function loadCoachVoicePick(): Promise<CoachVoicePick> {
  try {
    const raw = await AsyncStorage.getItem(coachVoicePickKey);
    if (!raw) return defaultCoachVoicePick;
    return normalizeVoicePick(JSON.parse(raw));
  } catch {
    return defaultCoachVoicePick;
  }
}

export async function saveCoachVoicePick(pick: CoachVoicePick): Promise<void> {
  try {
    await AsyncStorage.setItem(coachVoicePickKey, JSON.stringify(normalizeVoicePick(pick)));
  } catch {
    // 저장이 실패해도 지금 고른 목소리로 계속 들을 수 있게 조용히 넘어갑니다.
  }
}
