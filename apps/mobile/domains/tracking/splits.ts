// 러닝 중 1km를 지날 때마다 그 구간의 소요 시간을 확정하는 순수 계산기입니다.
// 화면·저장소는 이 파일이 만든 값을 그대로 쓰기만 하고, 시간 보간 규칙은 여기 한곳에만 둡니다.
import { MAX_ACTIVITY_SPLITS, type ActivitySplit } from '../activities/types';
import { formatPace, paceSecondsPerKm } from './pace';

/** 구간 하나의 길이(미터)입니다. */
export const SPLIT_DISTANCE_METERS = 1_000;

/** 마지막 자투리 구간은 이보다 짧으면 오차가 커서 기록하지 않습니다. */
export const MIN_TRAILING_SPLIT_METERS = 50;

export type SplitState = {
  /** 이미 확정한 1km 구간들입니다. */
  completed: ActivitySplit[];
  /** 마지막으로 확정한 구간 경계의 누적 거리(m)입니다. */
  boundaryMeters: number;
  /** 그 경계를 지난 시각(세션 시작 후 초). 보간으로 구한 값이라 소수일 수 있습니다. */
  boundarySeconds: number;
  /** 직전에 반영한 샘플. 경계 통과 시각을 선형 보간할 때 씁니다. */
  sampleMeters: number;
  sampleSeconds: number;
};

export const initialSplitState: SplitState = {
  completed: [],
  boundaryMeters: 0,
  boundarySeconds: 0,
  sampleMeters: 0,
  sampleSeconds: 0,
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(0, Math.min(1, value));
}

/** 소수 둘째 자리 킬로미터. 1km 경계는 항상 1, 2, 3…으로 떨어집니다. */
function toKm(meters: number): number {
  return Math.round((meters / 1_000) * 100) / 100;
}

/**
 * 지금까지의 누적 거리·경과 시간을 반영해 새로 완주한 1km 구간을 확정합니다.
 * - 한 번의 갱신에서 여러 km를 지나가도 모두 확정합니다(직전 샘플과 선형 보간).
 * - 거리가 줄거나 값이 이상하면 상태를 그대로 돌려줍니다.
 * - 아주 긴 활동에서도 메모리가 폭주하지 않도록 구간 수에 상한을 둡니다.
 */
export function advanceSplits(
  state: SplitState,
  distanceMeters: number,
  elapsedSeconds: number,
): SplitState {
  if (!Number.isFinite(distanceMeters) || !Number.isFinite(elapsedSeconds)) return state;

  const meters = Math.max(state.sampleMeters, distanceMeters);
  const seconds = Math.max(state.sampleSeconds, elapsedSeconds);
  if (meters === state.sampleMeters && seconds === state.sampleSeconds) return state;

  const spanMeters = meters - state.sampleMeters;
  const spanSeconds = seconds - state.sampleSeconds;

  let completed = state.completed;
  let boundaryMeters = state.boundaryMeters;
  let boundarySeconds = state.boundarySeconds;

  while (
    completed.length < MAX_ACTIVITY_SPLITS &&
    meters >= boundaryMeters + SPLIT_DISTANCE_METERS
  ) {
    const nextBoundaryMeters = boundaryMeters + SPLIT_DISTANCE_METERS;
    // 경계를 정확히 언제 지났는지는 알 수 없으므로 직전 샘플과의 사이를 선형 보간합니다.
    const ratio =
      spanMeters > 0 ? clamp01((nextBoundaryMeters - state.sampleMeters) / spanMeters) : 1;
    const nextBoundarySeconds = state.sampleSeconds + spanSeconds * ratio;

    completed = [
      ...completed,
      {
        km: toKm(nextBoundaryMeters),
        seconds: Math.max(0, Math.round(nextBoundarySeconds - boundarySeconds)),
      },
    ];
    boundaryMeters = nextBoundaryMeters;
    boundarySeconds = nextBoundarySeconds;
  }

  return {
    completed,
    boundaryMeters,
    boundarySeconds,
    sampleMeters: meters,
    sampleSeconds: seconds,
  };
}

/** 아직 1km를 채우지 못한 진행 중 구간입니다. 화면에 "지금 구간"으로 보여 줍니다. */
export function trailingSplit(
  state: SplitState,
  distanceMeters: number,
  elapsedSeconds: number,
): ActivitySplit | undefined {
  if (!Number.isFinite(distanceMeters) || !Number.isFinite(elapsedSeconds)) return undefined;
  const partialMeters = distanceMeters - state.boundaryMeters;
  if (partialMeters < MIN_TRAILING_SPLIT_METERS) return undefined;
  if (state.completed.length >= MAX_ACTIVITY_SPLITS) return undefined;
  return {
    km: toKm(distanceMeters),
    seconds: Math.max(0, Math.round(elapsedSeconds - state.boundarySeconds)),
  };
}

/** 세션을 끝낼 때 기록에 넣을 구간 목록입니다. 자투리 구간이 충분히 길면 마지막에 붙입니다. */
export function finalSplits(
  state: SplitState,
  distanceMeters: number,
  elapsedSeconds: number,
): ActivitySplit[] | undefined {
  const trailing = trailingSplit(state, distanceMeters, elapsedSeconds);
  const splits = trailing ? [...state.completed, trailing] : [...state.completed];
  return splits.length > 0 ? splits.slice(0, MAX_ACTIVITY_SPLITS) : undefined;
}

/** 구간 하나의 실제 길이(km)입니다. 마지막 자투리 구간은 1km보다 짧습니다. */
export function splitDistanceKm(splits: readonly ActivitySplit[], index: number): number {
  const split = splits[index];
  if (!split) return 0;
  const previous = index > 0 ? (splits[index - 1]?.km ?? 0) : 0;
  return Math.max(0, Math.round((split.km - previous) * 100) / 100);
}

/** 구간 페이스(1km당 초)입니다. 계산할 수 없으면 undefined입니다. */
export function splitPaceSecondsPerKm(
  splits: readonly ActivitySplit[],
  index: number,
): number | undefined {
  const split = splits[index];
  if (!split) return undefined;
  return paceSecondsPerKm(splitDistanceKm(splits, index) * 1_000, split.seconds);
}

/** "3km" 또는 마지막 자투리 구간이면 "3.42km"처럼 지점을 표시합니다. */
export function splitLabel(splits: readonly ActivitySplit[], index: number): string {
  const split = splits[index];
  if (!split) return '';
  return Number.isInteger(split.km) ? `${split.km}km` : `${split.km.toFixed(2)}km`;
}

/** 스크린리더용 한 줄 설명입니다. */
export function spokenSplit(splits: readonly ActivitySplit[], index: number): string {
  const split = splits[index];
  if (!split) return '';
  const minutes = Math.floor(split.seconds / 60);
  const seconds = split.seconds % 60;
  const time = minutes > 0 ? `${minutes}분 ${seconds}초` : `${seconds}초`;
  return `${splitLabel(splits, index)} 지점, 이 구간 ${time}, 페이스 ${formatPace(
    splitPaceSecondsPerKm(splits, index),
  )}`;
}

/** 가장 빠른 구간(완주한 1km 구간만)의 인덱스입니다. 없으면 undefined입니다. */
export function fastestSplitIndex(splits: readonly ActivitySplit[]): number | undefined {
  let best: number | undefined;
  let bestPace: number | undefined;
  for (let index = 0; index < splits.length; index += 1) {
    // 자투리 구간은 길이가 달라 비교 대상에서 뺍니다.
    if (splitDistanceKm(splits, index) < 0.99) continue;
    const pace = splitPaceSecondsPerKm(splits, index);
    if (pace === undefined) continue;
    if (bestPace === undefined || pace < bestPace) {
      bestPace = pace;
      best = index;
    }
  }
  return best;
}
