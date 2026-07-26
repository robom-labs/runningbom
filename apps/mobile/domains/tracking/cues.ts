// 누적 거리에서 "1킬로미터 지났어요" 같은 거리 안내 문장을 만드는 순수 함수입니다.
// 기존 코치 멘트 사전(cueLibrary)은 건드리지 않고, 화면에서 따로 덧붙여 쓰는 보조 멘트입니다.
import { metersToKilometers } from './geo';
import { formatPace } from './pace';

export type DistanceCue = {
  /** 이 멘트가 걸린 킬로미터 지점 */
  milestoneKm: number;
  text: string;
};

/** 마지막으로 안내한 킬로미터 지점. 아직 없으면 0입니다. */
export type DistanceCueState = {
  lastMilestoneKm: number;
};

export const initialDistanceCueState: DistanceCueState = { lastMilestoneKm: 0 };

/**
 * 지금 거리에서 새로 안내할 킬로미터 지점을 계산합니다.
 * 한 번에 여러 지점을 지나쳤어도 가장 최근 지점 하나만 말합니다(멘트 폭주 방지).
 */
export function nextDistanceCue(
  state: DistanceCueState,
  distanceMeters: number,
  currentPaceSecondsPerKm?: number,
): DistanceCue | undefined {
  const kilometers = metersToKilometers(distanceMeters);
  const milestone = Math.floor(kilometers);
  if (milestone <= state.lastMilestoneKm || milestone < 1) return undefined;

  const paceSuffix =
    currentPaceSecondsPerKm === undefined
      ? ''
      : ` 지금 페이스는 ${formatPace(currentPaceSecondsPerKm)}이에요.`;

  return {
    milestoneKm: milestone,
    text: `${milestone}킬로미터 지났어요.${paceSuffix}`,
  };
}

export function advanceDistanceCueState(
  state: DistanceCueState,
  cue: DistanceCue,
): DistanceCueState {
  return { lastMilestoneKm: Math.max(state.lastMilestoneKm, cue.milestoneKm) };
}
