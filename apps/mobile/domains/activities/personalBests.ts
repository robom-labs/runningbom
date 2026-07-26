// 저장된 활동에서 개인 최고 기록(PB)을 뽑는 순수 계산입니다.
//
// 정직성 원칙
// - 이 앱의 기록은 랩 단위 구간 기록이 아니라 "한 번의 활동 = 거리 + 시간" 한 쌍뿐입니다.
//   따라서 5K·10K·하프·풀의 "구간 기록"을 정확히 알 수 없습니다.
// - 대신 목표 거리 근처(허용 오차 범위) 활동의 평균 페이스로 환산한 **추정값**을 냅니다.
//   거리가 목표와 거의 같은 경우에만 `exact: true`로 실측에 가깝다고 표시하고,
//   그 밖에는 무엇을 어떻게 환산했는지 라벨로 그대로 드러냅니다.
// - 공인 기록·대회 기록이 아니며, 건강 상태에 대한 판단도 아닙니다.
import { kstDayKey, weekStartKey } from './summary';
import type { ActivityRecord } from './types';

export type PersonalBestKey = '5K' | '10K' | 'half' | 'full';

export type PersonalBestDefinition = {
  key: PersonalBestKey;
  label: string;
  /** 환산 기준이 되는 목표 거리(km) */
  targetKm: number;
  /** 이 범위 안의 활동만 후보로 삼습니다. */
  minKm: number;
  maxKm: number;
};

/**
 * 허용 오차 범위입니다. 너무 좁으면 후보가 없고, 너무 넓으면 환산이 왜곡되므로
 * 목표 거리의 대략 -6% ~ +10% 안에서 잡았습니다.
 */
export const personalBestDefinitions: PersonalBestDefinition[] = [
  { key: '5K', label: '5K', targetKm: 5, minKm: 4.7, maxKm: 5.5 },
  { key: '10K', label: '10K', targetKm: 10, minKm: 9.4, maxKm: 11 },
  { key: 'half', label: '하프', targetKm: 21.0975, minKm: 19.8, maxKm: 23 },
  { key: 'full', label: '풀', targetKm: 42.195, minKm: 39.5, maxKm: 46 },
];

/** 목표 거리와 이 정도 차이면 사실상 그 거리를 뛴 것으로 봅니다. */
const exactToleranceKm = 0.1;

export type PersonalBest = {
  key: PersonalBestKey;
  label: string;
  targetKm: number;
  activityId: string;
  completedAt: string;
  /** 실제로 저장된 활동 거리(km) */
  distanceKm: number;
  /** 실제로 저장된 활동 시간(분) */
  durationMinutes: number;
  paceMinutesPerKm: number;
  /** 목표 거리로 환산한 기록(분) */
  estimatedMinutes: number;
  /** 거리 오차가 아주 작아 실측에 가까운지 */
  exact: boolean;
  /** 시간 표기 (예: "24:31") */
  timeLabel: string;
  /** 추정임을 숨기지 않는 설명 문구 */
  accuracyLabel: string;
  /** 허용 오차 범위 안내 (예: "4.7~5.5km 활동을 후보로 봐요") */
  rangeLabel: string;
};

export function formatClockFromMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '기록 부족';
  const totalSeconds = Math.round(minutes * 60);
  const hours = Math.floor(totalSeconds / 3600);
  const rest = totalSeconds % 3600;
  const mm = Math.floor(rest / 60);
  const ss = rest % 60;
  if (hours > 0) {
    return `${hours}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }
  return `${mm}:${String(ss).padStart(2, '0')}`;
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function isPaceCandidate(activity: ActivityRecord): boolean {
  return (
    activity.kind === 'run' &&
    typeof activity.distanceKm === 'number' &&
    Number.isFinite(activity.distanceKm) &&
    activity.distanceKm > 0 &&
    Number.isFinite(activity.durationMinutes) &&
    activity.durationMinutes > 0
  );
}

function bestForDefinition(
  activities: ActivityRecord[],
  definition: PersonalBestDefinition,
): PersonalBest | undefined {
  let best: { activity: ActivityRecord; distanceKm: number; pace: number } | undefined;
  for (const activity of activities) {
    if (!isPaceCandidate(activity)) continue;
    const distanceKm = activity.distanceKm as number;
    if (distanceKm < definition.minKm || distanceKm > definition.maxKm) continue;
    const pace = activity.durationMinutes / distanceKm;
    if (!best || pace < best.pace) best = { activity, distanceKm, pace };
  }
  if (!best) return undefined;

  const estimatedMinutes = best.pace * definition.targetKm;
  const exact = Math.abs(best.distanceKm - definition.targetKm) <= exactToleranceKm;
  const rangeLabel = `${definition.minKm}~${definition.maxKm}km 활동을 후보로 봐요`;
  return {
    key: definition.key,
    label: definition.label,
    targetKm: definition.targetKm,
    activityId: best.activity.id,
    completedAt: best.activity.completedAt,
    distanceKm: roundTo(best.distanceKm, 2),
    durationMinutes: roundTo(best.activity.durationMinutes, 1),
    paceMinutesPerKm: roundTo(best.pace, 4),
    estimatedMinutes: roundTo(estimatedMinutes, 2),
    exact,
    timeLabel: formatClockFromMinutes(estimatedMinutes),
    accuracyLabel: exact
      ? `${roundTo(best.distanceKm, 2)}km 기록 그대로예요. 구간 계측이 아니라 활동 전체 평균이에요.`
      : `${roundTo(best.distanceKm, 2)}km · ${Math.round(best.activity.durationMinutes)}분 기록의 평균 페이스로 ${definition.label}를 환산한 추정값이에요.`,
    rangeLabel,
  };
}

/** 5K·10K·하프·풀 구간의 추정 최고 기록입니다. 후보가 없는 구간은 빠집니다. */
export function personalBests(activities: ActivityRecord[]): PersonalBest[] {
  const values: PersonalBest[] = [];
  for (const definition of personalBestDefinitions) {
    const best = bestForDefinition(activities, definition);
    if (best) values.push(best);
  }
  return values;
}

export type PersonalRecordKey = 'longestDistance' | 'longestDuration' | 'busiestWeek';

export type PersonalRecord = {
  key: PersonalRecordKey;
  label: string;
  valueLabel: string;
  /** 언제·무엇이었는지 한 줄 설명 */
  detail: string;
};

function longestDistance(activities: ActivityRecord[]): PersonalRecord | undefined {
  let best: { activity: ActivityRecord; distanceKm: number } | undefined;
  for (const activity of activities) {
    const distanceKm = activity.distanceKm ?? 0;
    if (!Number.isFinite(distanceKm) || distanceKm <= 0) continue;
    if (!best || distanceKm > best.distanceKm) best = { activity, distanceKm };
  }
  if (!best) return undefined;
  return {
    key: 'longestDistance',
    label: '최장 거리',
    valueLabel: `${roundTo(best.distanceKm, 1).toFixed(1)}km`,
    detail: `${kstDayKey(best.activity.completedAt)} · ${Math.round(best.activity.durationMinutes)}분`,
  };
}

function longestDuration(activities: ActivityRecord[]): PersonalRecord | undefined {
  let best: ActivityRecord | undefined;
  for (const activity of activities) {
    if (!Number.isFinite(activity.durationMinutes) || activity.durationMinutes <= 0) continue;
    if (!best || activity.durationMinutes > best.durationMinutes) best = activity;
  }
  if (!best) return undefined;
  const distance = best.distanceKm ? ` · ${roundTo(best.distanceKm, 1).toFixed(1)}km` : '';
  return {
    key: 'longestDuration',
    label: '최장 시간',
    valueLabel: `${Math.round(best.durationMinutes)}분`,
    detail: `${kstDayKey(best.completedAt)}${distance}`,
  };
}

/** 월요일 시작 주 기준으로 가장 많이 움직인 주입니다. */
function busiestWeek(activities: ActivityRecord[]): PersonalRecord | undefined {
  const counts = new Map<string, number>();
  for (const activity of activities) {
    const day = kstDayKey(activity.completedAt);
    if (!day) continue;
    const week = weekStartKey(day);
    counts.set(week, (counts.get(week) ?? 0) + 1);
  }
  let best: { week: string; count: number } | undefined;
  for (const [week, count] of counts) {
    if (!best || count > best.count || (count === best.count && week > best.week)) {
      best = { week, count };
    }
  }
  if (!best) return undefined;
  return {
    key: 'busiestWeek',
    label: '주간 최다 횟수',
    valueLabel: `${best.count}회`,
    detail: `${best.week} 주간`,
  };
}

export function personalRecords(activities: ActivityRecord[]): PersonalRecord[] {
  return [longestDistance(activities), longestDuration(activities), busiestWeek(activities)].filter(
    (value): value is PersonalRecord => value !== undefined,
  );
}

export type PersonalBestSummary = {
  bests: PersonalBest[];
  records: PersonalRecord[];
  /** 거리·시간이 모두 저장된 러닝 기록 수. 0이면 구간 추정 자체가 불가능합니다. */
  paceSampleCount: number;
  hasAny: boolean;
};

export function personalBestSummary(activities: ActivityRecord[]): PersonalBestSummary {
  const bests = personalBests(activities);
  const records = personalRecords(activities);
  return {
    bests,
    records,
    paceSampleCount: activities.filter(isPaceCandidate).length,
    hasAny: bests.length > 0 || records.length > 0,
  };
}
