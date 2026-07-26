// 대회 탐색의 거리·접수 필터 순서와 행사 단위 집계를 고정합니다.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  distances,
  filterByRegistrationStatus,
  registrationFilters,
  raceFeedFromRecords,
} from '../src/races';

const event = {
  id: 'seoul-run-2026',
  name: '서울 런',
  region: '서울',
  venue: '광화문',
  raceDate: '2026-10-10',
  distances: ['5K', '10K', 'Half'],
  registrationOpensAt: '2026-08-01T09:00:00+09:00',
  registrationClosesAt: '2026-09-20T17:00:00+09:00',
  registrationTimeConfirmed: true,
  registrationStatus: 'scheduled',
  sourceName: '공식',
};

test('대회 필터는 기존 2행 거리와 1행 접수 상태 순서를 유지한다', () => {
  assert.deepEqual(distances, ['전체', 'Full', 'Half', '10K', '5K', 'Trail']);
  assert.deepEqual(registrationFilters, ['전체', '접수 중', '접수 예정']);
});

test('여러 거리 종목을 가진 행사는 고유 ID 하나로만 집계된다', () => {
  const feed = raceFeedFromRecords('test-r1', [event, { ...event }], Date.parse('2026-07-26T00:00:00+09:00'));
  assert.equal(feed.races.length, 1);
  assert.equal(feed.races[0]?.distances.length, 3);
  assert.equal(filterByRegistrationStatus('접수 예정', feed.races, Date.parse('2026-07-26T00:00:00+09:00')).length, 1);
});
