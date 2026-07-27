// 저장된 활동 기록에서 훈련 계획 생성기의 입력값(주간 거리·주당 횟수·최근 4주 최장 거리)을 뽑습니다.
// 최근 4주만 봅니다. 4주는 "긴 거리 상한" 규칙이 보는 기간과 같아요.
import type { ActivityRecord } from '../activities/types';

export const RECENT_DAYS = 28;

export type RecentRunning = {
  /** 최근 4주 평균 주간 거리(km) */
  weeklyKm: number;
  /** 최근 4주 평균 주당 횟수 */
  runsPerWeek: number;
  /** 최근 4주 안에서 가장 길게 달린 거리(km) */
  longestKm: number;
  /** 계산에 쓴 기록 수입니다. 0이면 아직 근거가 없어요. */
  countedRuns: number;
  hasData: boolean;
};

export const emptyRecentRunning: RecentRunning = {
  weeklyKm: 0,
  runsPerWeek: 3,
  longestKm: 0,
  countedRuns: 0,
  hasData: false,
};

function distanceOf(activity: ActivityRecord): number {
  const km = activity.distanceKm;
  return typeof km === 'number' && Number.isFinite(km) && km > 0 ? km : 0;
}

export function recentRunning(
  activities: ActivityRecord[],
  now: number = Date.now(),
): RecentRunning {
  const since = now - RECENT_DAYS * 24 * 60 * 60 * 1000;
  const recent = activities.filter((activity) => {
    if (activity.kind !== 'run') return false;
    const at = Date.parse(activity.completedAt);
    return Number.isFinite(at) && at >= since && at <= now;
  });
  if (recent.length === 0) return emptyRecentRunning;
  const totalKm = recent.reduce((sum, activity) => sum + distanceOf(activity), 0);
  const longestKm = recent.reduce((max, activity) => Math.max(max, distanceOf(activity)), 0);
  const weeks = RECENT_DAYS / 7;
  const runsPerWeek = Math.min(6, Math.max(1, Math.round(recent.length / weeks)));
  return {
    weeklyKm: Math.round((totalKm / weeks) * 10) / 10,
    runsPerWeek,
    longestKm: Math.round(longestKm * 10) / 10,
    countedRuns: recent.length,
    hasData: totalKm > 0,
  };
}

/** 계획 카드 위에 "무엇을 근거로 만들었는지" 한 줄로 알려 주는 말입니다. */
export function recentRunningNote(summary: RecentRunning): string {
  if (!summary.hasData) {
    return '아직 거리 기록이 없어서 아주 천천히 늘리는 계획으로 만들었어요. 기록이 쌓이면 더 잘 맞게 바뀌어요.';
  }
  return `최근 4주 기록으로 만들었어요. 일주일에 약 ${summary.weeklyKm}킬로미터, ${summary.runsPerWeek}번 달렸고 가장 길게 달린 거리는 ${summary.longestKm}킬로미터예요.`;
}
