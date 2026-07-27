// 참가한 도전을 이 기기에 저장하는 값의 모양입니다. 저장·읽기는 useChallenges가 합니다.
// 새 키만 쓰고 기존 키(활동·설정·목표 대회 등)는 건드리지 않습니다.
import { isChallenge, type Challenge } from './types';

export const CHALLENGE_STORE_KEY = 'runningbom:vnext:challenges:v1';

/** 직접 만든 도전은 이만큼까지만 저장합니다. */
export const MAX_CUSTOM_CHALLENGES = 20;

export type ChallengeStore = {
  /** 참가한 도전의 id입니다(직접 만든 도전도 여기에 들어갑니다). */
  joinedIds: string[];
  /** 사용자가 직접 만든 도전 본체입니다. */
  customChallenges: Challenge[];
  /** 축하 카드를 이미 본 도전입니다. 같은 축하를 두 번 띄우지 않으려고 남깁니다. */
  celebratedIds: string[];
};

export const emptyChallengeStore: ChallengeStore = {
  joinedIds: [],
  customChallenges: [],
  celebratedIds: [],
};

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((item): item is string => typeof item === 'string')));
}

/** 저장 값이 깨져 있어도 앱이 멈추지 않도록 쓸 수 있는 부분만 살립니다. */
export function parseChallengeStore(value: unknown): ChallengeStore {
  if (!value || typeof value !== 'object') return emptyChallengeStore;
  const store = value as Partial<ChallengeStore>;
  const customChallenges = Array.isArray(store.customChallenges)
    ? store.customChallenges.filter(isChallenge).slice(0, MAX_CUSTOM_CHALLENGES)
    : [];
  return {
    joinedIds: stringList(store.joinedIds),
    customChallenges,
    celebratedIds: stringList(store.celebratedIds),
  };
}

export function joinChallenge(store: ChallengeStore, id: string): ChallengeStore {
  if (store.joinedIds.includes(id)) return store;
  return { ...store, joinedIds: [...store.joinedIds, id] };
}

/** 포기하면 참가 목록에서 빼고, 직접 만든 도전이면 본체도 함께 지웁니다. */
export function leaveChallenge(store: ChallengeStore, id: string): ChallengeStore {
  return {
    joinedIds: store.joinedIds.filter((item) => item !== id),
    customChallenges: store.customChallenges.filter((item) => item.id !== id),
    celebratedIds: store.celebratedIds.filter((item) => item !== id),
  };
}

export type AddCustomResult =
  | { ok: true; store: ChallengeStore }
  | { ok: false; message: string };

/** 직접 만든 도전은 만들자마자 참가 상태가 됩니다. */
export function addCustomChallenge(
  store: ChallengeStore,
  challenge: Challenge,
): AddCustomResult {
  if (store.customChallenges.length >= MAX_CUSTOM_CHALLENGES) {
    return {
      ok: false,
      message: `직접 만든 도전은 ${MAX_CUSTOM_CHALLENGES}개까지 둘 수 있어요. 하나를 지우고 다시 만들어 주세요.`,
    };
  }
  if (store.customChallenges.some((item) => item.id === challenge.id)) {
    return { ok: false, message: '같은 도전이 이미 있어요.' };
  }
  return {
    ok: true,
    store: {
      ...store,
      customChallenges: [...store.customChallenges, challenge],
      joinedIds: [...store.joinedIds, challenge.id],
    },
  };
}

export function markCelebrated(store: ChallengeStore, id: string): ChallengeStore {
  if (store.celebratedIds.includes(id)) return store;
  return { ...store, celebratedIds: [...store.celebratedIds, id] };
}
