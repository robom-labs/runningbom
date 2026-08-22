// 지난 방문 대회 피드의 최소 비교값을 기기에만 저장합니다.
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  isRaceVisitSnapshot,
  type RaceVisitSnapshot,
} from '../../domains/races/visitChanges';

export const RACE_VISIT_SNAPSHOT_KEY = 'runningbom:race-visit-snapshot:v1';

export async function loadRaceVisitSnapshot(): Promise<RaceVisitSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(RACE_VISIT_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isRaceVisitSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveRaceVisitSnapshot(snapshot: RaceVisitSnapshot): Promise<void> {
  try {
    await AsyncStorage.setItem(RACE_VISIT_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // 저장에 실패해도 최신 대회 데이터와 탐색 흐름은 그대로 씁니다.
  }
}
