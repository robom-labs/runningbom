// 목표 대회 1건을 이 기기에만 저장하고 모든 화면이 같은 값을 읽도록 하는 훅입니다.
// 규칙 계산은 goalRace.ts의 순수 함수에 있고, 여기서는 저장·복원만 담당합니다.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { GOAL_RACE_KEY, isGoalRace, type GoalRace } from './goalRace';
import type { RaceGroup } from './aggregate';

export type GoalRaceState = {
  goalRace?: GoalRace;
  ready: boolean;
  saveGoalRace: (group: RaceGroup) => Promise<void>;
  clearGoalRace: () => Promise<void>;
};

export function goalRaceFromGroup(group: RaceGroup, now: Date = new Date()): GoalRace {
  return {
    raceId: group.id,
    groupKey: group.key,
    name: group.name,
    raceDate: group.raceDate,
    region: group.region,
    savedAt: now.toISOString(),
  };
}

export function useGoalRace(): GoalRaceState {
  const [goalRace, setGoalRace] = useState<GoalRace | undefined>(undefined);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(GOAL_RACE_KEY)
      .then((raw) => {
        if (!active) return;
        if (raw) {
          try {
            const parsed: unknown = JSON.parse(raw);
            if (isGoalRace(parsed)) setGoalRace(parsed);
          } catch {
            // 저장 값이 깨졌으면 목표 대회가 없는 상태로 둡니다.
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

  const saveGoalRace = useCallback(async (group: RaceGroup) => {
    const next = goalRaceFromGroup(group);
    setGoalRace(next);
    try {
      await AsyncStorage.setItem(GOAL_RACE_KEY, JSON.stringify(next));
    } catch {
      // 저장에 실패해도 이번 실행 중에는 화면에 표시됩니다.
    }
  }, []);

  const clearGoalRace = useCallback(async () => {
    setGoalRace(undefined);
    try {
      await AsyncStorage.removeItem(GOAL_RACE_KEY);
    } catch {
      // 삭제 실패는 다음 실행에서 다시 복원될 수 있습니다.
    }
  }, []);

  return { ...(goalRace ? { goalRace } : {}), ready, saveGoalRace, clearGoalRace };
}
