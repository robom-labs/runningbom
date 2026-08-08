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
  startingWeeklyGoal,
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
import { saveCoachVoicePreference } from '../../domains/coaching/voicePreference';
import { onboardingPlanId, type StartingPointId } from '../../domains/programs/onboardingPlan';
import { PROGRAM_STORE_KEY, parseProgramStore, seedPlan } from '../../domains/programs/store';
import { goalFromPreset, type OnboardingResult } from '../screens/onboarding/steps';
import { loadOnboardingStatus, saveOnboardingStatus } from '../screens/onboarding/storage';
import {
  looksLikeExistingUser,
  resolveOnboardingStatus,
} from '../screens/onboarding/status';

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
  /**
   * 첫 실행 온보딩을 보여 줘야 하는지 알려 주는 플래그입니다.
   * 실제 화면 분기는 AppNavigator가 합니다(이 파일은 상태만 노출합니다).
   */
  onboardingRequired: boolean;
  completeOnboarding: (result: OnboardingResult) => Promise<void>;
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
  onboardingRequired: false,
  completeOnboarding: async () => undefined,
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


/**
 * 온보딩에서 고른 지금 상태에 맞는 계획을 깔아 둡니다.
 *
 * 저장 값을 읽어서 **이미 하던 계획이 있으면 그대로 둡니다**(seedPlan이 판단합니다).
 * 진행 중인 사람의 이력을 지우는 것은 되돌릴 수 없습니다.
 * 저장에 실패해도 온보딩은 계속 끝납니다. 계획이 없다고 앱을 못 쓰게 만들 이유가 없습니다.
 */
async function applyOnboardingPlan(startingPointId: StartingPointId): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(PROGRAM_STORE_KEY);
    const store = raw ? parseProgramStore(JSON.parse(raw)) : { completedSessionIds: [], attempts: [] };
    const next = seedPlan(store, onboardingPlanId(startingPointId));
    if (next === store) return;
    await AsyncStorage.setItem(PROGRAM_STORE_KEY, JSON.stringify(next));
  } catch {
    // 계획을 못 깔아도 온보딩은 끝납니다. 훈련 화면에서 직접 고를 수 있습니다.
  }
}

export function AppStateProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<string>();
  const [preferences, setPreferences] = useState<AppPreferences>(defaultPreferences);
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [plans, setPlans] = useState<RunPlan[]>([]);
  const [weeklyGoal, setWeeklyGoalState] = useState<WeeklyGoal>(defaultWeeklyGoal);
  const [onboardingRequired, setOnboardingRequired] = useState(false);
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
        const [loadedPlans, loadedGoal, savedOnboarding] = await Promise.all([
          loadRunPlans(),
          loadWeeklyGoal(),
          loadOnboardingStatus(),
        ]);
        if (!active) return;
        setPreferences(loadedPreferences);
        setActivities(loadedActivities);
        setPlans(loadedPlans);
        // 저장된 목표가 없으면 이력 → 경력(실력) → 안전 기본값 순으로 첫 목표를 정합니다.
        setWeeklyGoalState(
          loadedGoal ?? startingWeeklyGoal(loadedActivities, loadedPreferences.experienceLevel),
        );
        const onboarding = resolveOnboardingStatus(
          savedOnboarding,
          looksLikeExistingUser({
            activities: loadedActivities,
            plans: loadedPlans,
            ...(loadedGoal ? { storedGoal: loadedGoal } : {}),
          }),
        );
        setOnboardingRequired(onboarding.required);
        if (onboarding.nextStatus) void saveOnboardingStatus(onboarding.nextStatus);
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
    () => ({
      interestedRaceCount:
        preferences.interestedRaceGroupKeys.length + preferences.interestedRaceIds.length,
    }),
    [preferences.interestedRaceGroupKeys, preferences.interestedRaceIds],
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
    const recommended = recommendWeeklyGoal(
      activities,
      Date.now(),
      preferences.experienceLevel,
    );
    await setWeeklyGoal(recommended);
    return recommended;
  }, [activities, preferences.experienceLevel, setWeeklyGoal]);

  // 온보딩에서 고른 값을 각자의 기존 저장소에 넘겨주고 완료 여부만 새 키에 남깁니다.
  const completeOnboarding = useCallback(
    async (result: OnboardingResult) => {
      setOnboardingRequired(false);
      if (!result.skipped) {
        if (result.goalPresetId) {
          await setWeeklyGoal(goalFromPreset(result.goalPresetId, activities));
        }
        if (result.nickname) {
          await updatePreferences({ nickname: result.nickname });
        }
        if (result.voiceGender) {
          await saveCoachVoicePreference({ gender: result.voiceGender });
        }
        // 온보딩이 끝나는 순간 계획 하나가 **이미 깔려 있어야** 합니다.
        // 묻기만 하고 아무것도 해 주지 않으면, 물어본 것이 오히려 부담이 됩니다.
        if (result.startingPointId) {
          await applyOnboardingPlan(result.startingPointId);
        }
      }
      await saveOnboardingStatus({
        completed: true,
        reason: result.skipped ? 'skipped' : 'finished',
        completedAt: new Date().toISOString(),
      });
    },
    [activities, setWeeklyGoal, updatePreferences],
  );

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
      onboardingRequired,
      completeOnboarding,
    }),
    [
      activities,
      addPlan,
      applyRecommendedGoal,
      badgeProgress,
      badges,
      completeActivity,
      completeOnboarding,
      onboardingRequired,
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
