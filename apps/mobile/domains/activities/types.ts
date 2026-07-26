// 러닝봄의 로컬 활동 기록과 공개 가능한 출처 등급을 정의합니다.
export type ActivityKind = 'run' | 'walk' | 'recovery';
export type ActivitySource = 'COACH_COMPLETED' | 'HEALTH_LINKED' | 'SELF_LOGGED' | 'CREW_ATTENDANCE';

export type ActivityRecord = {
  id: string;
  localUuid: string;
  kind: ActivityKind;
  durationMinutes: number;
  distanceKm?: number;
  source: ActivitySource;
  completedAt: string;
  timezoneId: string;
  syncedAt?: string;
};

export const activitySourceLabels: Record<ActivitySource, string> = {
  COACH_COMPLETED: '러닝봄 코치 완주',
  HEALTH_LINKED: '건강앱에서 가져옴',
  SELF_LOGGED: '직접 입력',
  CREW_ATTENDANCE: '크루 참석',
};

export function activityCountsAsMovement(activity: ActivityRecord): boolean {
  if (activity.kind === 'recovery') return activity.durationMinutes >= 5;
  return activity.durationMinutes >= 10;
}

export function activityCountsAsCompetitiveRun(activity: ActivityRecord): boolean {
  return (
    activity.kind === 'run' &&
    activity.durationMinutes >= 10 &&
    activity.source === 'COACH_COMPLETED'
  );
}
