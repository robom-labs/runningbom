// 러닝봄의 로컬 활동, 환경설정, 스트릭 상태를 화면 사이에서 공유합니다.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { ActivityKind, ActivityRecord } from '../../domains/activities/types';
import { calculateStreak, unlockedBadges } from '../../domains/badges/rules';
import {
  initializeLocalDatabase,
  insertActivity,
  listActivities,
  queueActivityForSync,
} from '../../services/storage/localDatabase';
import {
  type AppPreferences,
  defaultPreferences,
  loadPreferences,
  savePreferences,
} from '../../services/storage/preferences';

const LOCAL_UUID_KEY = 'runningbom:vnext:local-uuid';

type CompleteActivityInput = {
  id?: string;
  kind: ActivityKind;
  durationMinutes: number;
  distanceKm?: number;
  source?: ActivityRecord['source'];
  completedAt?: string;
};

type AppStateValue = {
  ready: boolean;
  storageError?: string;
  preferences: AppPreferences;
  activities: ActivityRecord[];
  streak: ReturnType<typeof calculateStreak>;
  badges: ReturnType<typeof unlockedBadges>;
  updatePreferences: (next: Partial<AppPreferences>) => Promise<void>;
  completeActivity: (input: CompleteActivityInput) => Promise<ActivityRecord>;
  refreshActivities: () => Promise<void>;
};

const emptyStreak = calculateStreak([]);
const AppStateContext = createContext<AppStateValue>({
  ready: false,
  preferences: defaultPreferences,
  activities: [],
  streak: emptyStreak,
  badges: [],
  updatePreferences: async () => undefined,
  completeActivity: async () => {
    throw new Error('app state unavailable');
  },
  refreshActivities: async () => undefined,
});

async function getOrCreateLocalUuid(): Promise<string> {
  const existing = await AsyncStorage.getItem(LOCAL_UUID_KEY);
  if (existing) return existing;
  const next = Crypto.randomUUID();
  await AsyncStorage.setItem(LOCAL_UUID_KEY, next);
  return next;
}

export function AppStateProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<string>();
  const [preferences, setPreferences] = useState<AppPreferences>(defaultPreferences);
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const activityStorageAvailableRef = useRef(true);
  const memoryLocalUuidRef = useRef<string | undefined>(undefined);

  const refreshActivities = useCallback(async () => {
    if (!activityStorageAvailableRef.current) return;
    try {
      setActivities(await listActivities());
    } catch {
      activityStorageAvailableRef.current = false;
      setStorageError(
        '기기 저장소 오류로 이번 실행 중에만 기록해요. 앱을 닫으면 사라질 수 있어요.',
      );
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([initializeLocalDatabase(), loadPreferences()])
      .then(async ([, loadedPreferences]) => {
        const loadedActivities = await listActivities();
        if (!active) return;
        setPreferences(loadedPreferences);
        setActivities(loadedActivities);
        setReady(true);
      })
      .catch(() => {
        if (!active) return;
        activityStorageAvailableRef.current = false;
        setStorageError(
          '기기 저장소 오류로 이번 실행 중에만 기록해요. 앱을 닫으면 사라질 수 있어요.',
        );
        setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const updatePreferences = useCallback(async (next: Partial<AppPreferences>) => {
    setPreferences((current) => {
      const merged = { ...current, ...next };
      void savePreferences(merged).catch(() => {
        setStorageError('설정을 저장하지 못했어요.');
      });
      return merged;
    });
  }, []);

  const completeActivity = useCallback(async (input: CompleteActivityInput) => {
    let localUuid = memoryLocalUuidRef.current;
    if (activityStorageAvailableRef.current) {
      try {
        localUuid = await getOrCreateLocalUuid();
      } catch {
        activityStorageAvailableRef.current = false;
      }
    }
    if (!localUuid) {
      localUuid = Crypto.randomUUID();
    }
    memoryLocalUuidRef.current = localUuid;

    const record: ActivityRecord = {
      id: input.id ?? Crypto.randomUUID(),
      localUuid,
      kind: input.kind,
      durationMinutes: input.durationMinutes,
      ...(input.distanceKm === undefined ? {} : { distanceKm: input.distanceKm }),
      source: input.source ?? 'COACH_COMPLETED',
      completedAt: input.completedAt ?? new Date().toISOString(),
      timezoneId: 'Asia/Seoul',
    };
    if (activityStorageAvailableRef.current) {
      try {
        await insertActivity(record);
        if (record.source === 'SELF_LOGGED') {
          await queueActivityForSync(record);
        }
      } catch {
        activityStorageAvailableRef.current = false;
        setStorageError(
          '기기 저장소 오류로 이번 실행 중에만 기록해요. 앱을 닫으면 사라질 수 있어요.',
        );
      }
    }
    setActivities((current) => [record, ...current.filter((item) => item.id !== record.id)]);
    return record;
  }, []);

  const streak = useMemo(() => calculateStreak(activities), [activities]);
  const badges = useMemo(() => unlockedBadges(activities, streak), [activities, streak]);

  const value = useMemo<AppStateValue>(
    () => ({
      ready,
      ...(storageError ? { storageError } : {}),
      preferences,
      activities,
      streak,
      badges,
      updatePreferences,
      completeActivity,
      refreshActivities,
    }),
    [
      activities,
      badges,
      completeActivity,
      preferences,
      ready,
      refreshActivities,
      storageError,
      streak,
      updatePreferences,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  return useContext(AppStateContext);
}
