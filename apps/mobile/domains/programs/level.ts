// "이 사람에게 어떤 훈련이 맞는가"를 정하는 기준입니다.
//
// 원칙 세 가지:
//  1. 없는 값을 지어내지 않습니다. 심박·수면·최대산소섭취량은 우리에게 없으므로 쓰지 않습니다.
//  2. 사용자가 직접 고른 답을 존중하되, 실제 기록이 더 낮으면 낮은 쪽을 씁니다(안전).
//  3. 한 번의 좋은 기록으로 등급을 올리지 않습니다. 최근에 꾸준히 한 것만 인정합니다.
//
// 화면에는 L0·L5 같은 코드를 절대 보여 주지 않습니다. 쉬운 한국어 설명만 씁니다.
import type { ActivityRecord } from '../activities/types';

/** 내부에서만 쓰는 수준입니다. 낮을수록 시작 단계입니다. */
export type UserLevelId =
  | 'L0_MOVE'
  | 'L1_RUN_WALK'
  | 'L2_RUN_10'
  | 'L3_RUN_30'
  | 'L4_5K'
  | 'L5_10K'
  | 'L6_HALF'
  | 'L7_MARATHON'
  | 'L8_PERFORMANCE'
  | 'L9_ADVANCED';

/** 낮은 순서입니다. 비교할 때 이 순서를 씁니다. */
export const levelOrder: UserLevelId[] = [
  'L0_MOVE',
  'L1_RUN_WALK',
  'L2_RUN_10',
  'L3_RUN_30',
  'L4_5K',
  'L5_10K',
  'L6_HALF',
  'L7_MARATHON',
  'L8_PERFORMANCE',
  'L9_ADVANCED',
];

export function levelRank(level: UserLevelId): number {
  return levelOrder.indexOf(level);
}

export function isAtLeast(level: UserLevelId, minimum: UserLevelId): boolean {
  return levelRank(level) >= levelRank(minimum);
}

/** 화면에 보여 줄 쉬운 말입니다. */
export const levelLabels: Record<UserLevelId, string> = {
  L0_MOVE: '걷기부터 시작하고 싶어요',
  L1_RUN_WALK: '조금 뛰고 걸으면 계속할 수 있어요',
  L2_RUN_10: '10분 정도는 이어서 달려요',
  L3_RUN_30: '20~30분은 이어서 달려요',
  L4_5K: '5km를 완주해요',
  L5_10K: '10km를 완주해요',
  L6_HALF: '하프를 준비할 기반이 있어요',
  L7_MARATHON: '풀코스를 준비할 기반이 있어요',
  L8_PERFORMANCE: '기록을 체계적으로 줄이고 싶어요',
  L9_ADVANCED: '높은 수준으로 경기를 준비해요',
};

/** 사용자가 첫 화면에서 직접 고를 수 있는 여섯 가지입니다. 열 단계를 다 보여 주지 않습니다. */
export const selfPickLevels: UserLevelId[] = [
  'L0_MOVE',
  'L1_RUN_WALK',
  'L3_RUN_30',
  'L4_5K',
  'L5_10K',
  'L8_PERFORMANCE',
];

/** 최근 기록에서 뽑아낸, 수준을 판단할 재료입니다. 모르면 undefined로 둡니다(0과 구분). */
export type RunnerCapability = {
  /** 최근에 실제로 이어서 달린 가장 긴 시간(분)입니다. */
  longestRecentMinutes?: number;
  /** 최근에 달린 가장 긴 거리(km)입니다. */
  longestRecentKm?: number;
  /** 최근 4주의 주당 평균 활동 횟수입니다. */
  recentRunsPerWeek?: number;
  /** 최근 4주의 주당 평균 거리(km)입니다. */
  recentWeeklyKm?: number;
  /** 마지막으로 달린 뒤 지난 주 수입니다. */
  weeksSinceLastRun?: number;
};

const DAY_MILLIS = 86_400_000;
const RECENT_WINDOW_DAYS = 28;

/**
 * 기록이 전혀 없을 때 스스로 고를 수 있는 가장 높은 단계입니다.
 * 하프·풀코스·기록 단축은 한 번 눌렀다는 이유만으로 열지 않습니다.
 * 다치는 쪽은 되돌릴 수 없고, 며칠 기다리는 쪽은 되돌릴 수 있기 때문입니다.
 */
const EVIDENCE_FREE_CEILING: UserLevelId = 'L5_10K';

/**
 * 최근 28일 기록에서 수준 판단 재료를 뽑습니다.
 * 기록이 없으면 전부 undefined입니다. 0으로 채우지 않습니다.
 */
export function capabilityFromActivities(
  activities: ActivityRecord[],
  now: Date,
): RunnerCapability {
  const nowMillis = now.getTime();
  const windowStart = nowMillis - RECENT_WINDOW_DAYS * DAY_MILLIS;

  let longestMinutes: number | undefined;
  let longestKm: number | undefined;
  let sessions = 0;
  let totalKm = 0;
  let latestMillis: number | undefined;

  for (const activity of activities) {
    const at = Date.parse(activity.completedAt);
    if (!Number.isFinite(at)) continue;
    if (latestMillis === undefined || at > latestMillis) latestMillis = at;
    if (at < windowStart || at > nowMillis) continue;

    sessions += 1;
    // 걷기만 한 기록은 "이어서 달린 시간"으로 세지 않습니다.
    if (activity.kind === 'run') {
      if (longestMinutes === undefined || activity.durationMinutes > longestMinutes) {
        longestMinutes = activity.durationMinutes;
      }
      if (
        activity.distanceKm !== undefined &&
        (longestKm === undefined || activity.distanceKm > longestKm)
      ) {
        longestKm = activity.distanceKm;
      }
    }
    if (activity.distanceKm !== undefined) totalKm += activity.distanceKm;
  }

  const weeks = RECENT_WINDOW_DAYS / 7;
  const capability: RunnerCapability = {};
  if (longestMinutes !== undefined) capability.longestRecentMinutes = longestMinutes;
  if (longestKm !== undefined) capability.longestRecentKm = longestKm;
  if (sessions > 0) {
    capability.recentRunsPerWeek = sessions / weeks;
    if (totalKm > 0) capability.recentWeeklyKm = totalKm / weeks;
  }
  if (latestMillis !== undefined) {
    capability.weeksSinceLastRun = Math.max(0, (nowMillis - latestMillis) / (7 * DAY_MILLIS));
  }
  return capability;
}

/**
 * 기록만으로 판단한 수준입니다.
 * 기록이 없으면 undefined를 돌려주고, 판단을 사용자 선택에 맡깁니다.
 */
export function levelFromCapability(capability: RunnerCapability): UserLevelId | undefined {
  const { longestRecentKm, longestRecentMinutes, recentWeeklyKm, recentRunsPerWeek } = capability;
  if (
    longestRecentKm === undefined &&
    longestRecentMinutes === undefined &&
    recentWeeklyKm === undefined
  ) {
    return undefined;
  }

  // 하프 이상은 거리 하나로 열지 않습니다. 주간 거리와 횟수까지 봅니다.
  const consistent = (recentRunsPerWeek ?? 0) >= 2;
  if ((longestRecentKm ?? 0) >= 18 && (recentWeeklyKm ?? 0) >= 30 && consistent) return 'L6_HALF';
  if ((longestRecentKm ?? 0) >= 10 || (recentWeeklyKm ?? 0) >= 20) return 'L5_10K';
  if ((longestRecentKm ?? 0) >= 5 || (longestRecentMinutes ?? 0) >= 30) return 'L4_5K';
  if ((longestRecentMinutes ?? 0) >= 20) return 'L3_RUN_30';
  if ((longestRecentMinutes ?? 0) >= 10) return 'L2_RUN_10';
  if ((longestRecentMinutes ?? 0) > 0) return 'L1_RUN_WALK';
  return 'L0_MOVE';
}

export type LevelDecision = {
  level: UserLevelId;
  /** 왜 이 수준으로 봤는지 사용자에게 보여 줄 한 줄입니다. */
  reason: string;
  /** 기록이 사용자의 선택보다 낮아 낮춘 경우입니다. */
  loweredForSafety: boolean;
};

/**
 * 사용자가 고른 값과 실제 기록을 합쳐 최종 수준을 정합니다.
 *
 * 규칙: 둘 중 **낮은 쪽**을 씁니다.
 * 스스로 "하프 준비됐다"고 골라도 최근 기록이 5km뿐이면 5km 기준으로 봅니다.
 * 반대로 겸손하게 낮게 골랐다면 그 선택을 존중합니다(밀어붙이지 않습니다).
 */
export function decideLevel(
  selfPick: UserLevelId | undefined,
  capability: RunnerCapability,
): LevelDecision {
  const measured = levelFromCapability(capability);

  if (selfPick === undefined && measured === undefined) {
    return {
      level: 'L0_MOVE',
      reason: '아직 기록이 없어서 가장 편한 단계부터 안내해요.',
      loweredForSafety: false,
    };
  }
  if (selfPick === undefined && measured !== undefined) {
    return {
      level: measured,
      reason: '최근 기록을 보고 골랐어요.',
      loweredForSafety: false,
    };
  }
  if (selfPick !== undefined && measured === undefined) {
    // 기록이 하나도 없으면 하프 이상은 "골랐다"는 말만으로 열지 않습니다.
    // 실제로 그 정도를 달리는 분이라도, 이 앱에 기록이 쌓이면 바로 올라갑니다.
    if (levelRank(selfPick) > levelRank(EVIDENCE_FREE_CEILING)) {
      return {
        level: EVIDENCE_FREE_CEILING,
        reason: '아직 이 앱에 기록이 없어서 조금 낮은 단계부터 시작해요. 몇 번 달리면 바로 올라가요.',
        loweredForSafety: true,
      };
    }
    return {
      level: selfPick,
      reason: '고르신 내용을 그대로 따랐어요.',
      loweredForSafety: false,
    };
  }

  const picked = selfPick as UserLevelId;
  const found = measured as UserLevelId;
  if (levelRank(found) < levelRank(picked)) {
    return {
      level: found,
      reason: '최근 기록이 아직 적어서, 무리하지 않게 한 단계 낮춰 안내해요.',
      loweredForSafety: true,
    };
  }
  return {
    level: picked,
    reason: '고르신 내용을 그대로 따랐어요.',
    loweredForSafety: false,
  };
}
