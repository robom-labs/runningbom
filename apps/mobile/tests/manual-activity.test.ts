// 직접 활동 입력의 경계값과 경쟁 점수 제외 계약을 검증합니다.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseManualActivity } from '../domains/activities/manual';

describe('직접 활동 입력', () => {
  it('러닝 시간과 선택 거리를 정규화한다', () => {
    assert.deepEqual(
      parseManualActivity({
        kind: 'run',
        durationText: '30',
        distanceText: '5,25',
      }),
      {
        ok: true,
        movementCounts: true,
        value: { kind: 'run', durationMinutes: 30, distanceKm: 5.25 },
      },
    );
  });

  it('걷기와 회복은 거리 입력을 저장하지 않는다', () => {
    assert.deepEqual(
      parseManualActivity({
        kind: 'recovery',
        durationText: '5',
        distanceText: '99',
      }),
      {
        ok: true,
        movementCounts: true,
        value: { kind: 'recovery', durationMinutes: 5 },
      },
    );
  });

  it('스트릭 기준보다 짧은 기록은 저장 가능하지만 인정 여부를 구분한다', () => {
    assert.deepEqual(
      parseManualActivity({
        kind: 'walk',
        durationText: '9',
        distanceText: '',
      }),
      {
        ok: true,
        movementCounts: false,
        value: { kind: 'walk', durationMinutes: 9 },
      },
    );
  });

  it('잘못된 시간과 거리를 거부한다', () => {
    assert.equal(
      parseManualActivity({
        kind: 'run',
        durationText: '3.5',
        distanceText: '',
      }).ok,
      false,
    );
    assert.equal(
      parseManualActivity({
        kind: 'run',
        durationText: '30',
        distanceText: '-1',
      }).ok,
      false,
    );
  });
});
