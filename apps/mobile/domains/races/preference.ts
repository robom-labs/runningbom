// 사용자가 직접 저장한 대회 지역·거리 조건의 일치와 우선순위를 계산합니다.
import type { DistanceFilter, RegionFilter } from '../../src/types';
import type { RaceGroup } from './aggregate';

export type RacePreference = {
  region: RegionFilter;
  distance: DistanceFilter;
};

export const emptyRacePreference: RacePreference = { region: '전체', distance: '전체' };

export function hasRacePreference(preference: RacePreference | undefined): preference is RacePreference {
  return Boolean(preference && (preference.region !== '전체' || preference.distance !== '전체'));
}

export function raceGroupMatchesPreference(
  group: Pick<RaceGroup, 'region' | 'distances'>,
  preference: RacePreference | undefined,
): boolean {
  if (!preference || !hasRacePreference(preference)) return false;
  return (
    (preference.region === '전체' || group.region === preference.region)
    && (preference.distance === '전체' || group.distances.includes(preference.distance))
  );
}

/** 목표·관심 대회를 먼저 두고, 사용자가 저장한 조건과 일치하는 변화를 뒤이어 보입니다. */
export function raceGroupVisitPriority(
  group: Pick<RaceGroup, 'key' | 'raceIds' | 'region' | 'distances'>,
  options: {
    goalGroupKey?: string;
    interestedGroupKeys: readonly string[];
    legacyInterestedRaceIds: readonly string[];
    preference?: RacePreference;
  },
): number {
  if (options.goalGroupKey === group.key) return 0;
  if (
    options.interestedGroupKeys.includes(group.key)
    || group.raceIds.some((raceId) => options.legacyInterestedRaceIds.includes(raceId))
  ) return 1;
  return raceGroupMatchesPreference(group, options.preference) ? 2 : 3;
}
