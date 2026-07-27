// 보조 프로젝트 진행 상태를 이 기기에만 저장하고, 화면이 쓸 값으로 돌려줍니다.
// 계산은 library.ts·store.ts의 순수 함수가 하고 여기서는 저장·복원만 합니다.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { activeProjects, type ProjectProgress } from './library';
import {
  PROJECT_STORE_KEY,
  emptyProjectStore,
  parseProjectStore,
  toggleStep,
  type ProjectStore,
} from './store';

export type ProjectsState = {
  ready: boolean;
  /** 지금 보여 줄 프로젝트입니다. 하던 것이 먼저 옵니다. */
  shown: ProjectProgress[];
  doneStepIds: string[];
  /** 한 단계를 했다고 표시하거나 되돌립니다. */
  toggle: (stepId: string) => Promise<void>;
};

export function useProjects(limit = 3): ProjectsState {
  const [store, setStore] = useState<ProjectStore>(emptyProjectStore);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(PROJECT_STORE_KEY)
      .then((raw) => {
        if (!active) return;
        if (raw) {
          try {
            setStore(parseProjectStore(JSON.parse(raw)));
          } catch {
            // 저장 값이 깨졌으면 처음 시작하는 상태로 둡니다.
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

  const toggle = useCallback(
    async (stepId: string) => {
      const next = toggleStep(store, stepId);
      setStore(next);
      try {
        await AsyncStorage.setItem(PROJECT_STORE_KEY, JSON.stringify(next));
      } catch {
        // 저장에 실패해도 이번 실행 중에는 화면에 그대로 보입니다.
      }
    },
    [store],
  );

  const shown = useMemo(
    () => activeProjects(store.doneStepIds, limit),
    [limit, store.doneStepIds],
  );

  return { ready, shown, doneStepIds: store.doneStepIds, toggle };
}
