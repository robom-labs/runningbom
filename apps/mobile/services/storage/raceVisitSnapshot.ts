// 지난 방문 대회 피드의 최소 비교값을 기기에만 저장합니다.
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  isRaceVisitSnapshot,
  type RaceVisitChange,
  type RaceVisitSnapshot,
} from '../../domains/races/visitChanges';

export const RACE_VISIT_SNAPSHOT_KEY = 'runningbom:race-visit-snapshot:v1';
export const RACE_VISIT_INBOX_KEY = 'runningbom:race-visit-inbox:v1';
const RACE_VISIT_INBOX_VERSION = 1;

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

function isRaceVisitChange(value: unknown): value is RaceVisitChange {
  if (!value || typeof value !== 'object') return false;
  const change = value as Partial<RaceVisitChange>;
  return (
    typeof change.raceId === 'string' &&
    ['new-race', 'registration-opened', 'link-added', 'schedule-updated'].includes(change.kind ?? '') &&
    (change.detail === undefined || typeof change.detail === 'string')
  );
}

/** 아직 확인하지 않은 대회 변화를 기기에만 보관합니다. */
export async function loadRaceVisitInbox(): Promise<RaceVisitChange[]> {
  try {
    const raw = await AsyncStorage.getItem(RACE_VISIT_INBOX_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return [];
    const inbox = parsed as { version?: unknown; changes?: unknown };
    return inbox.version === RACE_VISIT_INBOX_VERSION && Array.isArray(inbox.changes) && inbox.changes.every(isRaceVisitChange)
      ? inbox.changes
      : [];
  } catch {
    return [];
  }
}

export async function saveRaceVisitInbox(changes: RaceVisitChange[]): Promise<void> {
  try {
    await AsyncStorage.setItem(RACE_VISIT_INBOX_KEY, JSON.stringify({ version: RACE_VISIT_INBOX_VERSION, changes }));
  } catch {
    // 변화함 저장에 실패해도 대회 탐색과 현재 데이터는 계속 사용할 수 있습니다.
  }
}

export async function clearRaceVisitInbox(): Promise<void> {
  try {
    await AsyncStorage.removeItem(RACE_VISIT_INBOX_KEY);
  } catch {
    // 다음 실행에서 한 번 더 보일 수 있지만, 대회 탐색은 계속 사용할 수 있습니다.
  }
}
