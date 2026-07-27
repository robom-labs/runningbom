// 달리는 중 경험 설정을 화면에서 읽고 바꾸는 훅입니다.
// 설정 화면에서 값을 바꾸면 달리기 화면도 다시 읽지 않고 바로 따라갑니다.
import { useCallback, useEffect, useState } from 'react';

import {
  defaultRunPreferences,
  loadRunPreferences,
  saveRunPreferences,
  subscribeRunPreferences,
  type RunPreferences,
} from '../../services/storage/runPreferences';

export type RunPreferencesController = {
  preferences: RunPreferences;
  /** 저장소에서 한 번이라도 읽었는지. 읽기 전에는 기본값을 씁니다. */
  loaded: boolean;
  update: (next: Partial<RunPreferences>) => Promise<void>;
};

export function useRunPreferences(): RunPreferencesController {
  const [preferences, setPreferences] = useState<RunPreferences>(defaultRunPreferences);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void loadRunPreferences().then((value) => {
      if (!active) return;
      setPreferences(value);
      setLoaded(true);
    });
    const unsubscribe = subscribeRunPreferences((value) => {
      if (active) setPreferences(value);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const update = useCallback(async (next: Partial<RunPreferences>) => {
    const saved = await saveRunPreferences(next);
    setPreferences(saved);
  }, []);

  return { preferences, loaded, update };
}
