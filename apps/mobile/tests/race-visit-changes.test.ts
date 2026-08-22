// 지난 방문 이후에 보여 줄 대회 변화가 안전하고 예측 가능하게 계산되는지 검증합니다.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createRaceVisitSnapshot,
  isRaceVisitSnapshot,
  raceVisitChangeLabel,
  raceVisitChanges,
} from '../domains/races/visitChanges';
import type { RaceFeed } from '../src/races';

function feed(revision: string, races: RaceFeed['races']): RaceFeed {
  return { revision, races };
}

function race(id: string, overrides: Partial<RaceFeed['races'][number]> = {}): RaceFeed['races'][number] {
  return {
    id,
    name: `${id} 마라톤`,
    region: '서울',
    venue: '여의도 한강공원',
    raceDate: '2026-10-10',
    distances: ['10K'],
    registrationOpensAt: '2026-08-01T10:00:00+09:00',
    registrationTimeConfirmed: true,
    registrationStatus: 'scheduled',
    sourceName: '마라톤GO',
    ...overrides,
  };
}

describe('지난 방문 이후 대회 변화', () => {
  it('첫 방문과 같은 데이터 버전에서는 변화를 꾸며내지 않는다', () => {
    const current = createRaceVisitSnapshot(feed('2026.08.22-race-data-52', [race('spring')]));
    assert.deepEqual(raceVisitChanges(null, current), []);
    assert.deepEqual(raceVisitChanges(current, current), []);
  });

  it('새 대회·확인된 접수 시작·링크 추가·일정 변경을 한 대회당 한 번만 고른다', () => {
    const before = createRaceVisitSnapshot(feed('2026.08.21-race-data-51', [
      race('opened'),
      race('unverified-opened'),
      race('link'),
      race('schedule'),
      race('multiple'),
    ]));
    const after = createRaceVisitSnapshot(feed('2026.08.22-race-data-52', [
      race('opened', { registrationStatus: 'open' }),
      race('unverified-opened', { registrationStatus: 'open', registrationDataStatus: 'needs-review' }),
      race('link', { sourceDetailUrl: 'https://example.com/race' }),
      race('schedule', { venue: '잠실운동장' }),
      race('multiple', { registrationStatus: 'open', sourceDetailUrl: 'https://example.com/multiple', venue: '잠실운동장' }),
      race('new'),
    ]));

    assert.deepEqual(raceVisitChanges(before, after), [
      { raceId: 'multiple', kind: 'registration-opened' },
      { raceId: 'opened', kind: 'registration-opened' },
      { raceId: 'new', kind: 'new-race' },
      { raceId: 'link', kind: 'link-added' },
      { raceId: 'schedule', kind: 'schedule-updated' },
    ]);
  });

  it('확인 필요인 접수 상태는 접수 시작으로 알리지 않는다', () => {
    const before = createRaceVisitSnapshot(feed('old', [race('review')]));
    const after = createRaceVisitSnapshot(feed('new', [
      race('review', { registrationStatus: 'open', registrationDataStatus: 'needs-review' }),
    ]));
    assert.deepEqual(raceVisitChanges(before, after), []);
  });

  it('저장값 형식을 검사하고 사용자용 꼬리표를 돌려준다', () => {
    const snapshot = createRaceVisitSnapshot(feed('new', [race('valid')]));
    assert.equal(isRaceVisitSnapshot(snapshot), true);
    assert.equal(isRaceVisitSnapshot({ ...snapshot, version: 2 }), false);
    assert.equal(raceVisitChangeLabel('registration-opened'), '접수 시작');
    assert.equal(raceVisitChangeLabel('new-race'), '새 대회');
    assert.equal(raceVisitChangeLabel('link-added'), '접수 정보 추가');
    assert.equal(raceVisitChangeLabel('schedule-updated'), '일정 변경');
  });
});
