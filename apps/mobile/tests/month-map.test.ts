// 이번 달 지도를 검증합니다.
//
// 여기서 보는 것 하나가 나머지보다 중요합니다:
//   **쉬어도 지도가 줄어들지 않는가.**
// 알(egg)을 안 쓰기로 한 이유가 바로 이것입니다. 잃을 수 있는 장치는 아픈 날에도 뛰게 만듭니다.
import assert from 'node:assert/strict';
import test from 'node:test';

import type { ActivityRecord } from '../domains/activities/types';
import { MONTH_MAP_NOTE, monthMap, terrains } from '../domains/growth/monthMap';

const now = new Date('2026-07-27T09:00:00+09:00');

function run(day: number, minutes: number): ActivityRecord {
  return {
    id: `a${day}-${minutes}`,
    localUuid: `u${day}-${minutes}`,
    kind: 'run',
    durationMinutes: minutes,
    completedAt: new Date(`2026-07-${String(day).padStart(2, '0')}T09:00:00+09:00`).toISOString(),
    timezoneId: 'Asia/Seoul',
    source: 'SELF_LOGGED',
  };
}

test('구간이 다섯 개이고 점점 멀어집니다', () => {
  assert.equal(terrains.length, 5);
  for (let index = 1; index < terrains.length; index += 1) {
    assert.ok((terrains[index] as { minutes: number }).minutes > (terrains[index - 1] as { minutes: number }).minutes);
  }
});

test('기록이 없으면 출발점입니다', () => {
  const map = monthMap([], now);
  assert.equal(map.current.id, 'start');
  assert.equal(map.minutes, 0);
});

test('쉬어도 지도가 줄어들지 않습니다', () => {
  // 이게 이 파일에서 가장 중요한 테스트입니다.
  const early = [run(1, 40), run(2, 40)];
  const before = monthMap(early, new Date('2026-07-03T09:00:00+09:00'));
  // 3주를 통째로 쉰 뒤에 다시 봅니다.
  const after = monthMap(early, new Date('2026-07-27T09:00:00+09:00'));
  assert.equal(after.minutes, before.minutes);
  assert.equal(after.current.id, before.current.id);
});

test('이번 달 것만 셉니다', () => {
  const lastMonth: ActivityRecord = {
    ...run(1, 500),
    id: 'old',
    completedAt: new Date('2026-06-15T09:00:00+09:00').toISOString(),
  };
  const map = monthMap([lastMonth, run(1, 30)], now);
  assert.equal(map.minutes, 30);
});

test('넘어선 구간 중 가장 뒤에 섭니다', () => {
  const map = monthMap([run(1, 90), run(2, 80)], now);
  assert.equal(map.minutes, 170);
  assert.equal(map.current.id, 'river');
  assert.equal(map.next?.id, 'hill');
});

test('다음 구간까지 남은 분을 알려 줍니다', () => {
  const map = monthMap([run(1, 100)], now);
  assert.equal(map.next?.id, 'river');
  assert.equal(map.remainingMinutes, 50);
  assert.ok(map.ratio > 0 && map.ratio < 1);
});

test('끝까지 가면 다음이 없고 실패라고 하지 않습니다', () => {
  const map = monthMap([run(1, 700)], now);
  assert.equal(map.current.id, 'ridge');
  assert.equal(map.next, undefined);
  assert.equal(map.ratio, 1);
  assert.ok(!map.note.includes('못'));
});

test('움직인 날 수는 하루에 여러 번 뛰어도 하루입니다', () => {
  const map = monthMap([run(1, 30), run(1, 20), run(2, 30)], now);
  assert.equal(map.activeDays, 2);
  assert.equal(map.minutes, 80);
});

test('어떤 구간에도 쉰 것을 벌하는 말이 없습니다', () => {
  // 성장 표시가 사람을 몰아붙이면, 몰아붙인 만큼 그만둡니다.
  const banned = ['실패', '놓쳤', '깨졌', '잃', '아쉽'];
  const blob = terrains.map((t) => `${t.label}${t.arrival}`).join('') + MONTH_MAP_NOTE;
  for (const word of banned) {
    assert.ok(!blob.includes(word), `"${word}"가 들어 있습니다`);
  }
});

test('쉬어도 사라지지 않는다고 앱 안에서 약속합니다', () => {
  assert.match(MONTH_MAP_NOTE, /쉬어도/);
});

test('시간이 이상한 기록이 섞여도 셈이 깨지지 않습니다', () => {
  const broken: ActivityRecord = { ...run(1, -30), id: 'x', completedAt: '이상한값' };
  const map = monthMap([broken, run(1, 30)], now);
  assert.equal(map.minutes, 30);
});
