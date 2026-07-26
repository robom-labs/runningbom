// 사용자가 직접 등록한 '예정된 러닝' 일정을 검증하고 날짜별로 묶는 순수 규칙입니다.
import type { ActivityKind } from './types';

export type RunPlan = {
  id: string;
  date: string;
  kind: ActivityKind;
  title: string;
  targetMinutes?: number;
  targetDistanceKm?: number;
  createdAt: string;
};

export type RunPlanDraft = {
  date: string;
  kind: ActivityKind;
  title: string;
  minutesText: string;
  distanceText: string;
};

export type RunPlanValue = Omit<RunPlan, 'id' | 'createdAt'>;

export type RunPlanParseResult =
  | { ok: true; value: RunPlanValue }
  | { ok: false; message: string };

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function normalizedNumber(value: string): number {
  return Number(value.trim().replace(',', '.'));
}

export function parseRunPlan(draft: RunPlanDraft): RunPlanParseResult {
  const date = draft.date.trim();
  if (!datePattern.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    return { ok: false, message: '날짜는 2026-08-01 형식으로 선택해 주세요.' };
  }

  const title = draft.title.normalize('NFKC').trim().replace(/\s+/g, ' ').slice(0, 40);

  let targetMinutes: number | undefined;
  const minutesText = draft.minutesText.trim();
  if (minutesText) {
    targetMinutes = normalizedNumber(minutesText);
    if (!Number.isInteger(targetMinutes) || targetMinutes < 1 || targetMinutes > 1_440) {
      return { ok: false, message: '예정 시간은 1분부터 1,440분까지 정수로 입력해 주세요.' };
    }
  }

  let targetDistanceKm: number | undefined;
  const distanceText = draft.distanceText.trim();
  if (distanceText) {
    targetDistanceKm = normalizedNumber(distanceText);
    if (!Number.isFinite(targetDistanceKm) || targetDistanceKm <= 0 || targetDistanceKm > 500) {
      return { ok: false, message: '예정 거리는 0보다 크고 500km 이하로 입력해 주세요.' };
    }
    targetDistanceKm = Math.round(targetDistanceKm * 100) / 100;
  }

  return {
    ok: true,
    value: {
      date,
      kind: draft.kind,
      title: title || '러닝 일정',
      ...(targetMinutes === undefined ? {} : { targetMinutes }),
      ...(targetDistanceKm === undefined ? {} : { targetDistanceKm }),
    },
  };
}

export function plansByDate(plans: RunPlan[]): Map<string, RunPlan[]> {
  const result = new Map<string, RunPlan[]>();
  for (const plan of plans) {
    result.set(plan.date, [...(result.get(plan.date) ?? []), plan]);
  }
  return result;
}

export function upcomingPlans(plans: RunPlan[], todayKey: string, limit = 5): RunPlan[] {
  return plans
    .filter((plan) => plan.date >= todayKey)
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(0, limit);
}

export function isRunPlan(value: unknown): value is RunPlan {
  if (!value || typeof value !== 'object') return false;
  const plan = value as Partial<RunPlan>;
  return (
    typeof plan.id === 'string' &&
    typeof plan.date === 'string' &&
    datePattern.test(plan.date) &&
    (plan.kind === 'run' || plan.kind === 'walk' || plan.kind === 'recovery') &&
    typeof plan.title === 'string' &&
    typeof plan.createdAt === 'string'
  );
}
