// 일시정지 중 움직임과 GPS 흔들림이 거리·페이스에 섞이지 않는지 검증합니다.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  acceptFix,
  emptyTrackAccumulator,
  type LocationFix,
} from '../domains/tracking/filter';
import { reanchorTrackWithoutDistance } from '../domains/tracking/pause';

const startMillis = Date.UTC(2026, 6, 27, 0, 0, 0);
const base = { latitudeDeg: 37.5663, longitudeDeg: 126.9779 };

function northOf(meters: number) {
  return {
    latitudeDeg: base.latitudeDeg + meters / 111_195,
    longitudeDeg: base.longitudeDeg,
  };
}

function fix(offsetMeters: number, secondsFromStart: number, accuracyMeters = 8): LocationFix {
  const point = northOf(offsetMeters);
  return {
    latitudeDeg: point.latitudeDeg,
    longitudeDeg: point.longitudeDeg,
    accuracyMeters,
    timestampMillis: startMillis + secondsFromStart * 1_000,
  };
}

describe('일시정지 GPS 기준점', () => {
  it('일시정지 중 이동을 거리로 더하지 않고 재개 뒤 실제 이동만 이어 붙인다', () => {
    const first = acceptFix(emptyTrackAccumulator, fix(0, 0));
    const beforePause = acceptFix(first, fix(100, 20));
    const pausedDistance = beforePause.distanceMeters;

    // 사용자가 기록을 멈춘 채 400m 이동해도 거리에는 들어가지 않습니다.
    const reanchored = reanchorTrackWithoutDistance(beforePause, fix(500, 120));
    assert.equal(reanchored.distanceMeters, pausedDistance);
    assert.equal(reanchored.movingMillis, beforePause.movingMillis);
    assert.equal(reanchored.recentSegments.length, 0);
    assert.equal(reanchored.anchor?.timestampMillis, startMillis + 120_000);

    // 다시 시작한 뒤의 20m만 새로 더해집니다.
    const resumed = acceptFix(reanchored, fix(520, 125));
    assert.ok(
      resumed.distanceMeters > pausedDistance + 18 && resumed.distanceMeters < pausedDistance + 22,
      `일시정지 전후 거리 ${resumed.distanceMeters}m`,
    );
  });

  it('정확도가 나쁜 재개 좌표는 기준점으로 쓰지 않는다', () => {
    const first = acceptFix(emptyTrackAccumulator, fix(0, 0));
    const reanchored = reanchorTrackWithoutDistance(first, fix(300, 30, 100));

    assert.equal(reanchored.distanceMeters, 0);
    assert.equal(reanchored.anchor?.timestampMillis, first.anchor?.timestampMillis);
    assert.equal(reanchored.lastRejectReason, 'accuracy');
  });
});
