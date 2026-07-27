// 프로그램 진행 상태를 이 기기에만 저장하고, 화면이 쓸 값으로 다시 계산해 넘깁니다.
// 규칙 계산은 progress.ts·store.ts의 순수 함수에 있고 여기서는 저장·복원만 합니다.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { beginnerProgram } from './beginnerProgram';
import { programProgress, type ProgramProgress, type SessionAttempt } from './progress';
import {
  PROGRAM_STORE_KEY,
  emptyProgramStore,
  parseProgramStore,
  restartProgram,
  saveAttempt,
  type ProgramStore,
} from './store';

export type ProgramsState = {
  ready: boolean;
  progress: ProgramProgress;
  attempts: SessionAttempt[];
  /** 회차를 마쳤을 때 부릅니다. markComplete가 false면 기록만 남고 다음으로 넘어가지 않아요. */
  finishSession: (attempt: SessionAttempt, markComplete: boolean) => Promise<void>;
  /** 처음부터 다시 하기입니다. */
  restart: () => Promise<void>;
};

export function usePrograms(): ProgramsState {
  const [store, setStore] = useState<ProgramStore>(emptyProgramStore);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(PROGRAM_STORE_KEY)
      .then((raw) => {
        if (!active) return;
        if (raw) {
          try {
            setStore(parseProgramStore(JSON.parse(raw)));
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

  const persist = useCallback(async (next: ProgramStore) => {
    setStore(next);
    try {
      await AsyncStorage.setItem(PROGRAM_STORE_KEY, JSON.stringify(next));
    } catch {
      // 저장에 실패해도 이번 실행 중에는 화면에 그대로 보입니다.
    }
  }, []);

  const progress = useMemo(
    () => programProgress(store.completedSessionIds, beginnerProgram),
    [store.completedSessionIds],
  );

  const finishSession = useCallback(
    (attempt: SessionAttempt, markComplete: boolean) =>
      persist(saveAttempt(store, attempt, markComplete)),
    [persist, store],
  );

  const restart = useCallback(() => persist(restartProgram(store)), [persist, store]);

  return { ready, progress, attempts: store.attempts, finishSession, restart };
}
