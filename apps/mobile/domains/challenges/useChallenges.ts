// 참가한 도전을 이 기기에만 저장하고, 활동 기록으로 진행률을 다시 계산해 화면에 넘깁니다.
// 규칙 계산은 progress.ts·catalog.ts의 순수 함수에 있고 여기서는 저장·복원만 합니다.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { ActivityRecord } from '../activities/types';
import { builtInChallenges, type GoalRaceSeed } from './catalog';
import {
  challengeProgress,
  challengeSections,
  pendingCelebration,
  recommendChallenge,
  type ChallengeProgress,
  type ChallengeSections,
} from './progress';
import {
  CHALLENGE_STORE_KEY,
  addCustomChallenge,
  emptyChallengeStore,
  joinChallenge,
  leaveChallenge,
  markCelebrated,
  parseChallengeStore,
  type ChallengeStore,
} from './store';
import type { Challenge } from './types';

export type ChallengesState = ChallengeSections & {
  ready: boolean;
  /** 참가한 게 없을 때 크게 보여 줄 추천 1개입니다. */
  recommended?: ChallengeProgress;
  /** 아직 축하를 보지 않은 완료 도전입니다. */
  celebration?: ChallengeProgress;
  customChallenges: Challenge[];
  isJoined: (id: string) => boolean;
  join: (id: string) => Promise<void>;
  leave: (id: string) => Promise<void>;
  addCustom: (challenge: Challenge) => Promise<string | undefined>;
  celebrate: (id: string) => Promise<void>;
};

export function useChallenges(input: {
  activities: ActivityRecord[];
  goalRace?: GoalRaceSeed;
  /** 테스트·미리보기에서 오늘을 고정할 때만 씁니다. */
  now?: number;
}): ChallengesState {
  const { activities, goalRace, now } = input;
  const [store, setStore] = useState<ChallengeStore>(emptyChallengeStore);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(CHALLENGE_STORE_KEY)
      .then((raw) => {
        if (!active) return;
        if (raw) {
          try {
            setStore(parseChallengeStore(JSON.parse(raw)));
          } catch {
            // 저장 값이 깨졌으면 참가한 도전이 없는 상태로 시작합니다.
          }
        }
        setReady(true);
      })
      .catch(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const persist = useCallback(async (next: ChallengeStore) => {
    setStore(next);
    try {
      await AsyncStorage.setItem(CHALLENGE_STORE_KEY, JSON.stringify(next));
    } catch {
      // 저장에 실패해도 이번 실행 중에는 화면에 그대로 보입니다.
    }
  }, []);

  // 화면이 열린 시각을 한 번만 잡습니다. 매 렌더마다 오늘이 바뀌면 진행률이 계속 다시 계산돼요.
  const [openedAt] = useState(() => Date.now());
  const timestamp = now ?? openedAt;
  const allProgress = useMemo(() => {
    const catalog = [...builtInChallenges(timestamp, goalRace), ...store.customChallenges];
    return catalog.map((challenge) => challengeProgress(challenge, activities, timestamp));
    // 활동이나 참가 목록이 바뀔 때만 다시 계산합니다.
  }, [activities, goalRace, store.customChallenges, timestamp]);

  const sections = useMemo(
    () => challengeSections(allProgress, store.joinedIds),
    [allProgress, store.joinedIds],
  );

  const recommended = useMemo(
    () => (sections.mine.length === 0 ? recommendChallenge(sections.available) : undefined),
    [sections.available, sections.mine.length],
  );

  const celebration = useMemo(
    () => pendingCelebration(sections.mine, store.celebratedIds),
    [sections.mine, store.celebratedIds],
  );

  const isJoined = useCallback((id: string) => store.joinedIds.includes(id), [store.joinedIds]);
  const join = useCallback((id: string) => persist(joinChallenge(store, id)), [persist, store]);
  const leave = useCallback((id: string) => persist(leaveChallenge(store, id)), [persist, store]);
  const celebrate = useCallback(
    (id: string) => persist(markCelebrated(store, id)),
    [persist, store],
  );
  const addCustom = useCallback(
    async (challenge: Challenge) => {
      const result = addCustomChallenge(store, challenge);
      if (!result.ok) return result.message;
      await persist(result.store);
      return undefined;
    },
    [persist, store],
  );

  return {
    ...sections,
    ready,
    ...(recommended ? { recommended } : {}),
    ...(celebration ? { celebration } : {}),
    customChallenges: store.customChallenges,
    isJoined,
    join,
    leave,
    addCustom,
    celebrate,
  };
}
