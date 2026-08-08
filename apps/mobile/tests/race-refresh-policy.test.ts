// 대회 데이터의 앱 재진입 자동 갱신 경계가 바뀌지 않도록 검증합니다.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  RACE_FOREGROUND_REFRESH_INTERVAL_MS,
  shouldRefreshRaceDataAfterBackground,
} from '../app/state/raceRefreshPolicy';

describe('대회 데이터 재진입 갱신', () => {
  it('10분 미만 백그라운드는 다시 받지 않는다', () => {
    assert.equal(
      shouldRefreshRaceDataAfterBackground(1_000, 1_000 + RACE_FOREGROUND_REFRESH_INTERVAL_MS - 1),
      false,
    );
  });

  it('10분 이상 백그라운드 뒤에는 다시 확인한다', () => {
    assert.equal(
      shouldRefreshRaceDataAfterBackground(1_000, 1_000 + RACE_FOREGROUND_REFRESH_INTERVAL_MS),
      true,
    );
  });

  it('백그라운드 진입 시각이 없거나 잘못됐으면 갱신하지 않는다', () => {
    assert.equal(shouldRefreshRaceDataAfterBackground(null, 1_000), false);
    assert.equal(shouldRefreshRaceDataAfterBackground(Number.NaN, 1_000), false);
  });
});
