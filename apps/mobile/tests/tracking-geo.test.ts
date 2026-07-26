// GPS 거리 계산과 잡음 필터가 과장 없이 실제 이동만 누적하는지 검증합니다.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  acceptFix,
  accumulateFixes,
  defaultTrackFilterOptions,
  emptyTrackAccumulator,
  type LocationFix,
} from '../domains/tracking/filter';
import {
  haversineMeters,
  isValidGeoPoint,
  metersToKilometers,
  polylineMeters,
  roundedKilometers,
} from '../domains/tracking/geo';
import {
  averagePaceSecondsPerKm,
  currentPaceSecondsPerKm,
  formatDistanceKm,
  formatPace,
  paceSecondsPerKm,
  spokenPace,
} from '../domains/tracking/pace';
import {
  gpsSignalLevel,
  trackedDistanceForActivity,
  trackingSnapshot,
} from '../domains/tracking/session';
import {
  advanceDistanceCueState,
  initialDistanceCueState,
  nextDistanceCue,
} from '../domains/tracking/cues';
import {
  activityPaceSecondsPerKm,
  averagePaceForActivities,
  formatActivityPace,
  withTrackedDistance,
} from '../domains/activities/pace';
import type { ActivityRecord } from '../domains/activities/types';

const startMillis = Date.UTC(2026, 6, 26, 0, 0, 0);
/** 서울 시청 근처 기준점 */
const base = { latitudeDeg: 37.5663, longitudeDeg: 126.9779 };

/** 위도 1도는 약 111.19km이므로 미터를 위도 증가분으로 바꿉니다. */
function northOf(meters: number) {
  return { latitudeDeg: base.latitudeDeg + meters / 111_195, longitudeDeg: base.longitudeDeg };
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

describe('Haversine 거리 계산', () => {
  it('같은 좌표는 0미터다', () => {
    assert.equal(haversineMeters(base, base), 0);
  });

  it('북쪽으로 100미터 이동을 1미터 오차 안에서 계산한다', () => {
    const meters = haversineMeters(base, northOf(100));
    assert.ok(Math.abs(meters - 100) < 1, `기대 100m, 실제 ${meters}m`);
  });

  it('알려진 두 도시 거리를 1퍼센트 오차 안에서 계산한다', () => {
    // 서울시청 ~ 부산시청 직선 거리는 약 325km입니다.
    const meters = haversineMeters(base, { latitudeDeg: 35.1798, longitudeDeg: 129.0750 });
    assert.ok(Math.abs(meters - 325_000) / 325_000 < 0.01, `실제 ${meters}m`);
  });

  it('대칭이며 잘못된 좌표는 0으로 처리한다', () => {
    assert.equal(
      haversineMeters(base, northOf(250)).toFixed(6),
      haversineMeters(northOf(250), base).toFixed(6),
    );
    assert.equal(haversineMeters(base, { latitudeDeg: 999, longitudeDeg: 0 }), 0);
    assert.equal(isValidGeoPoint({ latitudeDeg: 91, longitudeDeg: 0 }), false);
    assert.equal(isValidGeoPoint({ latitudeDeg: Number.NaN, longitudeDeg: 0 }), false);
  });

  it('경로 합계와 킬로미터 변환이 일치한다', () => {
    const meters = polylineMeters([base, northOf(100), northOf(300)]);
    assert.ok(Math.abs(meters - 300) < 2);
    assert.equal(metersToKilometers(-5), 0);
    assert.equal(roundedKilometers(1_234), 1.23);
  });
});

describe('GPS 잡음 필터', () => {
  it('첫 좌표는 기준점만 잡고 거리를 만들지 않는다', () => {
    const next = acceptFix(emptyTrackAccumulator, fix(0, 0));
    assert.equal(next.distanceMeters, 0);
    assert.ok(next.anchor);
  });

  it('정확도가 나쁜 좌표는 버리고 기준점을 옮기지 않는다', () => {
    const first = acceptFix(emptyTrackAccumulator, fix(0, 0));
    const next = acceptFix(first, fix(200, 10, 80));
    assert.equal(next.distanceMeters, 0);
    assert.equal(next.lastRejectReason, 'accuracy');
    assert.equal(next.anchor?.latitudeDeg, first.anchor?.latitudeDeg);
  });

  it('정지 중 미세 잡음은 거리를 늘리지 않는다', () => {
    const stationary: LocationFix[] = [fix(0, 0)];
    for (let index = 1; index <= 30; index += 1) {
      // 1~2미터 안에서 흔들리는 좌표를 30번 받습니다.
      stationary.push(fix(index % 2 === 0 ? 1.5 : 0, index * 2));
    }
    const result = accumulateFixes(stationary);
    assert.equal(result.distanceMeters, 0);
    assert.equal(result.lastRejectReason, 'stationary');
  });

  it('비현실적으로 빠른 한 번의 튐은 거리에 넣지 않는다', () => {
    const jumped = accumulateFixes([fix(0, 0), fix(500, 5), fix(10, 10)]);
    assert.ok(jumped.distanceMeters < 20, `실제 ${jumped.distanceMeters}m`);
    assert.ok(jumped.rejectedCount >= 1);
  });

  it('빠른 좌표가 계속 이어지면 기준점을 다시 잡아 추적이 멈추지 않는다', () => {
    const result = accumulateFixes([
      fix(0, 0),
      fix(500, 5),
      fix(1_000, 10),
      fix(1_500, 15),
      fix(1_530, 25),
    ]);
    // 튐 구간은 거리에 넣지 않지만, 재설정 뒤의 정상 구간(약 30m)은 인정합니다.
    assert.ok(result.distanceMeters > 25 && result.distanceMeters < 40, `실제 ${result.distanceMeters}m`);
  });

  it('오래 끊긴 구간은 거리를 지어내지 않고 기준점만 다시 잡는다', () => {
    const gap = accumulateFixes([fix(0, 0), fix(400, 120)]);
    assert.equal(gap.distanceMeters, 0);
    assert.equal(gap.lastRejectReason, 'gap');
    assert.equal(gap.anchor?.timestampMillis, startMillis + 120_000);
  });

  it('시간이 거꾸로 가는 좌표는 무시한다', () => {
    const result = accumulateFixes([fix(0, 10), fix(50, 5)]);
    assert.equal(result.distanceMeters, 0);
    assert.equal(result.lastRejectReason, 'out-of-order');
  });

  it('정상 러닝 좌표는 실제 이동 거리를 누적한다', () => {
    // 3초마다 15미터씩(약 5m/s = 3분 20초 페이스) 20번 이동
    const fixes = Array.from({ length: 21 }, (_, index) => fix(index * 15, index * 3));
    const result = accumulateFixes(fixes);
    assert.ok(Math.abs(result.distanceMeters - 300) < 3, `실제 ${result.distanceMeters}m`);
    assert.equal(result.rejectedCount, 0);
  });
});

describe('페이스 계산', () => {
  it('1km를 5분에 달리면 300초 페이스다', () => {
    assert.equal(paceSecondsPerKm(1_000, 300), 300);
    assert.equal(formatPace(300), `5'00"`);
    assert.equal(formatPace(330), `5'30"`);
  });

  it('거리나 시간이 없으면 페이스를 단정하지 않는다', () => {
    assert.equal(paceSecondsPerKm(0, 300), undefined);
    assert.equal(paceSecondsPerKm(1_000, 0), undefined);
    assert.equal(averagePaceSecondsPerKm(0, 600), undefined);
    assert.equal(formatPace(undefined), `--'--"`);
    assert.equal(spokenPace(undefined), '아직 측정 중');
    assert.equal(spokenPace(330), '1킬로미터에 5분 30초');
  });

  it('현재 페이스는 최근 구간만 본다', () => {
    const fixes = Array.from({ length: 21 }, (_, index) => fix(index * 15, index * 3));
    const result = accumulateFixes(fixes);
    const pace = currentPaceSecondsPerKm(result);
    assert.ok(pace !== undefined && Math.abs(pace - 200) < 10, `실제 ${String(pace)}`);
    assert.equal(currentPaceSecondsPerKm(emptyTrackAccumulator), undefined);
    assert.equal(formatDistanceKm(1_234), '1.23');
  });
});

describe('추적 스냅샷', () => {
  const fixes = Array.from({ length: 21 }, (_, index) => fix(index * 15, index * 3));
  const accumulator = accumulateFixes(fixes);
  const nowMillis = startMillis + 60_000;

  it('권한이 허용되면 거리와 신호를 보여 준다', () => {
    const snapshot = trackingSnapshot({
      permission: 'granted',
      accumulator,
      elapsedSeconds: 60,
      nowMillis,
    });
    assert.equal(snapshot.measuring, true);
    assert.ok(snapshot.distanceKm > 0.29 && snapshot.distanceKm < 0.31);
    assert.equal(snapshot.signal, 'good');
    assert.equal(snapshot.statusLabel, 'GPS 양호');
  });

  it('권한을 거부해도 오류가 아니라 측정 안 함으로만 표시한다', () => {
    const snapshot = trackingSnapshot({
      permission: 'denied',
      accumulator,
      elapsedSeconds: 60,
      nowMillis,
    });
    assert.equal(snapshot.measuring, false);
    assert.equal(snapshot.distanceKm, 0);
    assert.equal(snapshot.averagePaceSecondsPerKm, undefined);
    assert.equal(snapshot.statusLabel, '측정 안 함');
    assert.match(snapshot.statusDetail, /코칭/);
    assert.equal(trackedDistanceForActivity(snapshot), undefined);
  });

  it('좌표가 한동안 없으면 신호를 낮춘다', () => {
    assert.equal(
      gpsSignalLevel({ permission: 'granted', accumulator, nowMillis: startMillis + 200_000 }),
      'searching',
    );
    assert.equal(
      gpsSignalLevel({ permission: 'granted', accumulator: emptyTrackAccumulator, nowMillis }),
      'searching',
    );
    assert.equal(
      gpsSignalLevel({ permission: 'denied', accumulator, nowMillis }),
      'unavailable',
    );
  });

  it('너무 짧은 거리는 활동 기록에 넣지 않는다', () => {
    const tiny = trackingSnapshot({
      permission: 'granted',
      accumulator: accumulateFixes([fix(0, 0), fix(10, 3)]),
      elapsedSeconds: 3,
      nowMillis: startMillis + 3_000,
    });
    assert.equal(trackedDistanceForActivity(tiny), undefined);

    const real = trackingSnapshot({
      permission: 'granted',
      accumulator,
      elapsedSeconds: 60,
      nowMillis,
    });
    assert.equal(typeof trackedDistanceForActivity(real), 'number');
  });
});

describe('거리 안내 멘트', () => {
  it('1킬로미터를 지나야 첫 안내가 나온다', () => {
    assert.equal(nextDistanceCue(initialDistanceCueState, 900), undefined);
    const cue = nextDistanceCue(initialDistanceCueState, 1_020);
    assert.equal(cue?.milestoneKm, 1);
    assert.match(cue?.text ?? '', /1킬로미터 지났어요/);
  });

  it('같은 지점을 두 번 말하지 않는다', () => {
    const first = nextDistanceCue(initialDistanceCueState, 1_020);
    assert.ok(first);
    const state = advanceDistanceCueState(initialDistanceCueState, first);
    assert.equal(nextDistanceCue(state, 1_400), undefined);
    assert.equal(nextDistanceCue(state, 2_100)?.milestoneKm, 2);
  });

  it('페이스를 알면 멘트에 함께 담는다', () => {
    const cue = nextDistanceCue(initialDistanceCueState, 1_020, 330);
    assert.match(cue?.text ?? '', /5'30"/);
  });
});

describe('활동 기록 페이스 파생', () => {
  function activity(overrides: Partial<ActivityRecord> = {}): ActivityRecord {
    return {
      id: 'a',
      localUuid: 'local',
      kind: 'run',
      durationMinutes: 30,
      source: 'COACH_COMPLETED',
      completedAt: '2026-07-26T00:00:00.000Z',
      timezoneId: 'Asia/Seoul',
      ...overrides,
    };
  }

  it('거리와 시간에서 평균 페이스를 되살린다', () => {
    assert.equal(activityPaceSecondsPerKm({ durationMinutes: 30, distanceKm: 6 }), 300);
    assert.equal(formatActivityPace({ durationMinutes: 30, distanceKm: 6 }), `5'00"`);
  });

  it('거리가 없는 기존 기록은 그대로 다룬다', () => {
    assert.equal(activityPaceSecondsPerKm({ durationMinutes: 30 }), undefined);
    assert.equal(formatActivityPace({ durationMinutes: 30 }), '거리 없음');
    assert.equal(averagePaceForActivities([activity()]), undefined);
  });

  it('추적 거리는 저장 가능한 범위 안에서만 덧붙인다', () => {
    assert.deepEqual(withTrackedDistance({ durationMinutes: 30 }, 5.678), {
      durationMinutes: 30,
      distanceKm: 5.68,
    });
    assert.deepEqual(withTrackedDistance({ durationMinutes: 30 }, undefined), {
      durationMinutes: 30,
    });
    assert.deepEqual(withTrackedDistance({ durationMinutes: 30 }, 900), { durationMinutes: 30 });
    assert.deepEqual(withTrackedDistance({ durationMinutes: 30 }, 0), { durationMinutes: 30 });
  });

  it('거리가 있는 기록만 모아 평균 페이스를 낸다', () => {
    const average = averagePaceForActivities([
      activity({ id: 'b', durationMinutes: 30, distanceKm: 6 }),
      activity({ id: 'c', durationMinutes: 20, distanceKm: 4 }),
      activity({ id: 'd', durationMinutes: 40 }),
    ]);
    assert.equal(average, 300);
  });
});
