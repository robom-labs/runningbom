// 사용자가 직접 저장한 대회 조건이 목록·변화 우선순위에 안전하게 적용되는지 검증합니다.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { groupRaces } from '../domains/races/aggregate';
import {
  hasRacePreference,
  raceGroupMatchesPreference,
  raceGroupVisitPriority,
} from '../domains/races/preference';
import type { Race } from '../src/types';

function race(id: string, overrides: Partial<Race> = {}): Race {
  return {
    id,
    name: `${id} 마라톤`,
    region: '서울',
    venue: '여의도 한강공원',
    raceDate: '2026-10-10',
    distances: ['10K'],
    registrationOpensAt: '2026-08-01T10:00:00+09:00',
    registrationTimeConfirmed: true,
    sourceName: '마라톤GO',
    ...overrides,
  };
}

describe('내 대회 조건', () => {
  const groups = groupRaces([
    race('seoul-10k'),
    race('seoul-full', { distances: ['Full'], raceDate: '2026-10-11' }),
    race('busan-10k', { region: '부산', raceDate: '2026-10-12' }),
  ]);

  it('사용자가 하나라도 직접 고른 경우에만 조건을 활성으로 본다', () => {
    assert.equal(hasRacePreference(undefined), false);
    assert.equal(hasRacePreference({ region: '전체', distance: '전체' }), false);
    assert.equal(hasRacePreference({ region: '서울', distance: '전체' }), true);
    assert.equal(hasRacePreference({ region: '전체', distance: '10K' }), true);
  });

  it('지역과 거리 모두 일치하는 대회만 조건에 맞는다고 본다', () => {
    const preference = { region: '서울', distance: '10K' } as const;
    assert.equal(raceGroupMatchesPreference(groups[0]!, preference), true);
    assert.equal(raceGroupMatchesPreference(groups[1]!, preference), false);
    assert.equal(raceGroupMatchesPreference(groups[2]!, preference), false);
  });

  it('목표·관심·내 조건·나머지 순으로 변화 우선순위를 준다', () => {
    const preference = { region: '서울', distance: '10K' } as const;
    assert.equal(raceGroupVisitPriority(groups[0]!, {
      goalGroupKey: groups[0]!.key,
      interestedGroupKeys: [],
      legacyInterestedRaceIds: [],
      preference,
    }), 0);
    assert.equal(raceGroupVisitPriority(groups[1]!, {
      interestedGroupKeys: [groups[1]!.key],
      legacyInterestedRaceIds: [],
      preference,
    }), 1);
    assert.equal(raceGroupVisitPriority(groups[0]!, {
      interestedGroupKeys: [],
      legacyInterestedRaceIds: [],
      preference,
    }), 2);
    assert.equal(raceGroupVisitPriority(groups[2]!, {
      interestedGroupKeys: [],
      legacyInterestedRaceIds: [],
      preference,
    }), 3);
  });
});
