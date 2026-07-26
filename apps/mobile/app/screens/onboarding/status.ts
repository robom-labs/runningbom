// 첫 실행 온보딩을 "다시 띄울지" 판단하는 순수 규칙입니다.
// 저장소를 모르기 때문에 그대로 테스트할 수 있습니다.
import type { WeeklyGoal } from '../../../domains/badges/goals';

/** 온보딩 완료 여부만 담는 새 저장 키입니다. 기존 키는 건드리지 않습니다. */
export const ONBOARDING_KEY = 'runningbom:vnext:onboarding:v1';

export type OnboardingStatus = {
  completed: boolean;
  /** 끝까지 봤는지, 건너뛰었는지, 기존 사용자라 자동으로 넘겼는지 구분합니다. */
  reason?: 'finished' | 'skipped' | 'existing-user';
  completedAt?: string;
};

export const emptyOnboardingStatus: OnboardingStatus = { completed: false };

export function parseOnboardingStatus(value: unknown): OnboardingStatus {
  if (!value || typeof value !== 'object') return emptyOnboardingStatus;
  const record = value as Partial<OnboardingStatus>;
  if (record.completed !== true) return emptyOnboardingStatus;
  return {
    completed: true,
    ...(record.reason ? { reason: record.reason } : {}),
    ...(record.completedAt ? { completedAt: record.completedAt } : {}),
  };
}

/**
 * 이미 앱을 쓰던 사람인지 판단합니다.
 * 활동 기록·러닝 일정·저장된 주간 목표 중 하나라도 있으면 기존 사용자로 봅니다.
 */
export function looksLikeExistingUser(input: {
  activities: unknown[];
  plans: unknown[];
  storedGoal?: WeeklyGoal;
}): boolean {
  return input.activities.length > 0 || input.plans.length > 0 || input.storedGoal !== undefined;
}

export function resolveOnboardingStatus(
  saved: OnboardingStatus,
  existingUser: boolean,
  now: string = new Date().toISOString(),
): { required: boolean; nextStatus?: OnboardingStatus } {
  if (saved.completed) return { required: false };
  if (existingUser) {
    // 기록이 있는 사용자에게는 절대 온보딩을 띄우지 않고, 조용히 완료로 표시합니다.
    return {
      required: false,
      nextStatus: { completed: true, reason: 'existing-user', completedAt: now },
    };
  }
  return { required: true };
}
