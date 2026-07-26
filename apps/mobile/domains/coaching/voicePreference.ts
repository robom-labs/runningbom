// 코치 음성(남성/여성) 선택값을 coaching 도메인에서 직접 보관합니다.
// 공용 preferences 저장소는 읽기만 하고 건드리지 않기 위해 별도 키를 씁니다.
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  defaultCoachVoicePreference,
  normalizeVoicePreference,
  type CoachVoicePreference,
} from './voice';

const KEY = 'runningbom:coaching:voice:v1';

export {
  defaultCoachVoicePreference,
  normalizeVoicePreference,
  type CoachVoicePreference,
} from './voice';

export async function loadCoachVoicePreference(): Promise<CoachVoicePreference> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return defaultCoachVoicePreference;
    return normalizeVoicePreference(JSON.parse(raw));
  } catch {
    return defaultCoachVoicePreference;
  }
}

export async function saveCoachVoicePreference(
  preference: CoachVoicePreference,
): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(preference));
  } catch {
    // 저장 실패는 코칭 진행을 막지 않습니다.
  }
}
