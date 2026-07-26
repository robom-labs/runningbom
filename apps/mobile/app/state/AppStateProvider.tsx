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

import { isRunPlan, type RunPlan, type RunPlanValue } from '../../domains/activities/plans';
import type { ActivityKind, ActivityRecord } from '../../domains/activities/types';
import {
  badgeProgressList,
  calculateStreak,
  unlockedBadges,
  type BadgeProgress,
} from '../../domains/badges/rules';
import {
  defaultWeeklyGoal,
  isWeeklyGoal,
  recommendWeeklyGoal,
  type WeeklyGoal,
} from '../../domains/badges/goals';
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
const RUN_PLAN_KEY = 'runningbom:vnext:run-plans:v1';
const WEEKLY_GOAL_KEY = 'runningbom:vnext:weekly-goal:v1';

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
  plans: RunPlan[];
  weeklyGoal: WeeklyGoal;
  streak: ReturnType<typeof calculateStreak>;
  badges: ReturnType<typeof unlockedBadges>;
  badgeProgress: BadgeProgress[];
  updatePreferences: (next: Partial<AppPreferences>) => Promise<void>;
  completeActivity: (input: CompleteActivityInput) => Promise<ActivityRecord>;
  refreshActivities: () => Promise<void>;
  addPlan: (value: RunPlanValue) => Promise<RunPlan>;
  removePlan: (planId: string) => Promise<void>;
  setWeeklyGoal: (goal: WeeklyGoal) => Promise<void>;
  applyRecommendedGoal: () => Promise<WeeklyGoal>;
};

const emptyStreak = calculateStreak([]);
const AppStateContext = createContext<AppStateValue>({
  ready: false,
  preferences: defaultPreferences,
  activities: [],
  plans: [],
  weeklyGoal: defaultWeeklyGoal,
  streak: emptyStreak,
  badges: [],
  badgeProgress: [],
  updatePreferences: async () => undefined,
  completeActivity: async () => {
    throw new Error('app state unavailable');
  },
  refreshActivities: async () => undefined,
  addPlan: async () => {
    throw new Error('app state unavailable');
  },
  removePlan: async () => undefined,
  setWeeklyGoal: async () => undefined,
  applyRecommendedGoal: async () => defaultWeeklyGoal,
});

async function loadRunPlans(): Promise<RunPlan[]> {
  try {
    const raw = await AsyncStorage.getItem(RUN_PLAN_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isRunPlan) : [];
  } catch {
    return [];
  }
}

async function loadWeeklyGoal(): Promise<WeeklyGoal | undefined> {
  try {
    const raw = await AsyncStorage.getItem(WEEKLY_GOAL_KEY);
    if (!raw) return undefined;
    const parsed: unknown = JSON.parse(raw);
    return isWeeklyGoal(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

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
  const [plans, setPlans] = useState<RunPlan[]>([]);
  const [weeklyGoal, setWeeklyGoalState] = useState<WeeklyGoal>(defaultWeeklyGoal);
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
        const [loadedPlans, loadedGoal] = await Promise.all([loadRunPlans(), loadWeeklyGoal()]);
        if (!active) return;
        setPreferences(loadedPreferences);
        setActivities(loadedActivities);
        setPlans(loadedPlans);
        setWeeklyGoalState(loadedGoal ?? recommendWeeklyGoal(loadedActivities));
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

  const addPlan = useCallback(
    async (value: RunPlanValue) => {
      const plan: RunPlan = {
        ...value,
        id: Crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      };
      let next: RunPlan[] = [];
      setPlans((current) => {
        next = [...current, plan].sort((left, right) => left.date.localeCompare(right.date));
        return next;
      });
      try {
        await AsyncStorage.setItem(RUN_PLAN_KEY, JSON.stringify(next));
      } catch {
        setStorageError('러닝 일정을 저장하지 못했어요. 이번 실행 중에만 유지됩니다.');
      }
      return plan;
    },
    [],
  );

  const removePlan = useCallback(
    async (planId: string) => {
      let next: RunPlan[] = [];
      setPlans((current) => {
        next = current.filter((plan) => plan.id !== planId);
        return next;
      });
      try {
        await AsyncStorage.setItem(RUN_PLAN_KEY, JSON.stringify(next));
      } catch {
        setStorageError('러닝 일정을 저장하지 못했어요. 이번 실행 중에만 유지됩니다.');
      }
    },
    [],
  );

  const setWeeklyGoal = useCallback(async (goal: WeeklyGoal) => {
    setWeeklyGoalState(goal);
    try {
      await AsyncStorage.setItem(WEEKLY_GOAL_KEY, JSON.stringify(goal));
    } catch {
      setStorageError('주간 목표를 저장하지 못했어요.');
    }
  }, []);

  const streak = useMemo(() => calculateStreak(activities), [activities]);
  const badgeContext = useMemo(
    () => ({ interestedRaceCount: preferences.interestedRaceIds.length }),
    [preferences.interestedRaceIds],
  );
  const badgeProgress = useMemo(
    () => badgeProgressList(activities, streak, badgeContext),
    [activities, badgeContext, streak],
  );
  const badges = useMemo(
    () => badgeProgress.filter((entry) => entry.unlocked).map((entry) => entry.badge),
    [badgeProgress],
  );

  const applyRecommendedGoal = useCallback(async () => {
    const recommended = recommendWeeklyGoal(activities);
    await setWeeklyGoal(recommended);
    return recommended;
  }, [activities, setWeeklyGoal]);

  const value = useMemo<AppStateValue>(
    () => ({
      ready,
      ...(storageError ? { storageError } : {}),
      preferences,
      activities,
      plans,
      weeklyGoal,
      streak,
      badges,
      badgeProgress,
      updatePreferences,
      completeActivity,
      refreshActivities,
      addPlan,
      removePlan,
      setWeeklyGoal,
      applyRecommendedGoal,
    }),
    [
      activities,
      addPlan,
      applyRecommendedGoal,
      badgeProgress,
      badges,
      completeActivity,
      plans,
      preferences,
      ready,
      refreshActivities,
      removePlan,
      setWeeklyGoal,
      storageError,
      streak,
      updatePreferences,
      weeklyGoal,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  return useContext(AppStateContext);
}
