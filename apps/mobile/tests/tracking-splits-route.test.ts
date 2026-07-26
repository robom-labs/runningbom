// 구간(랩) 기록, 경로 좌표 솎기, 추적 빈 상태 안내가 실사용 조건에서 어긋나지 않는지 검증합니다.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import packageJson from '../package.json';
import {
  MAX_ACTIVITY_ROUTE_POINTS,
  MAX_ACTIVITY_SPLITS,
  sanitizeRoutePoints,
  sanitizeSplits,
  type ActivityRecord,
} from '../domains/activities/types';
import {
  advanceSplits,
  fastestSplitIndex,
  finalSplits,
  initialSplitState,
  splitDistanceKm,
  splitLabel,
  splitPaceSecondsPerKm,
  spokenSplit,
  trailingSplit,
} from '../domains/tracking/splits';
import {
  appendRouteFix,
  defaultRouteThinningOptions,
  downsampleRoute,
  emptyRouteState,
  routePointSummary,
  routePointsForActivity,
} from '../domains/tracking/route';
import { emptyTrackAccumulator, type LocationFix } from '../domains/tracking/filter';
import { trackingNotice, trackingSnapshot } from '../domains/tracking/session';

const startMillis = Date.UTC(2026, 6, 26, 0, 0, 0);
const base = { latitudeDeg: 37.5663, longitudeDeg: 126.9779 };

/** 위도 1도는 약 111.19km이므로 미터를 위도 증가분으로 바꿉니다. */
function fix(offsetMeters: number, secondsFromStart: number, accuracyMeters = 8): LocationFix {
  return {
    latitudeDeg: base.latitudeDeg + offsetMeters / 111_195,
    longitudeDeg: base.longitudeDeg,
    accuracyMeters,
    timestampMillis: startMillis + secondsFromStart * 1_000,
  };
}

describe('1km 구간(랩) 기록', () => {
  it('1km를 지날 때마다 그 구간 시간을 확정한다', () => {
    const first = advanceSplits(initialSplitState, 1_000, 300);
    assert.deepEqual(first.completed, [{ km: 1, seconds: 300 }]);

    const second = advanceSplits(first, 2_000, 640);
    assert.deepEqual(second.completed, [
      { km: 1, seconds: 300 },
      { km: 2, seconds: 340 },
    ]);
  });

  it('한 번에 여러 km를 지나가도 선형 보간으로 모두 확정한다', () => {
    const state = advanceSplits(initialSplitState, 2_500, 1_000);
    assert.deepEqual(state.completed, [
      { km: 1, seconds: 400 },
      { km: 2, seconds: 400 },
    ]);
  });

  it('아직 1km를 못 채운 구간은 진행 중 구간으로만 보여 준다', () => {
    const state = advanceSplits(initialSplitState, 2_500, 1_000);
    const trailing = trailingSplit(state, 2_500, 1_000);
    assert.deepEqual(trailing, { km: 2.5, seconds: 200 });
  });

  it('50m도 못 간 자투리는 기록하지 않는다', () => {
    const state = advanceSplits(initialSplitState, 1_020, 300);
    // 1km 경계는 1020m 지점보다 조금 앞이므로 보간한 294초가 1km 구간 시간이 됩니다.
    assert.deepEqual(state.completed, [{ km: 1, seconds: 294 }]);
    assert.equal(trailingSplit(state, 1_020, 300), undefined);
    assert.deepEqual(finalSplits(state, 1_020, 300), [{ km: 1, seconds: 294 }]);
  });

  it('거리가 줄거나 값이 이상하면 상태를 그대로 둔다', () => {
    const state = advanceSplits(initialSplitState, 1_500, 450);
    assert.equal(advanceSplits(state, 1_200, 400), state);
    assert.equal(advanceSplits(state, Number.NaN, 500), state);
  });

  it('아주 긴 활동에서도 구간 수 상한을 넘지 않는다', () => {
    const state = advanceSplits(initialSplitState, (MAX_ACTIVITY_SPLITS + 50) * 1_000, 900_000);
    assert.equal(state.completed.length, MAX_ACTIVITY_SPLITS);
  });

  it('구간 거리·페이스·표시 문구를 파생값으로 계산한다', () => {
    const splits = [
      { km: 1, seconds: 300 },
      { km: 2, seconds: 360 },
      { km: 2.5, seconds: 150 },
    ];
    assert.equal(splitDistanceKm(splits, 1), 1);
    assert.equal(splitDistanceKm(splits, 2), 0.5);
    assert.equal(splitPaceSecondsPerKm(splits, 0), 300);
    assert.equal(splitPaceSecondsPerKm(splits, 2), 300);
    assert.equal(splitLabel(splits, 1), '2km');
    assert.equal(splitLabel(splits, 2), '2.50km');
    // 자투리 구간은 길이가 달라 "가장 빠른 구간" 비교에서 뺍니다.
    assert.equal(fastestSplitIndex(splits), 0);
    assert.match(spokenSplit(splits, 0), /1km 지점/);
  });

  it('기록이 없으면 구간 배열 자체를 만들지 않는다', () => {
    assert.equal(finalSplits(initialSplitState, 20, 30), undefined);
  });
});

describe('경로 좌표 솎기', () => {
  it('첫 좌표는 항상 남기고 t는 세션 시작 후 경과 초로 저장한다', () => {
    const state = appendRouteFix(emptyRouteState, fix(0, 10));
    assert.equal(state.points.length, 1);
    assert.deepEqual(state.points[0], {
      lat: Number(base.latitudeDeg.toFixed(5)),
      lon: Number(base.longitudeDeg.toFixed(5)),
      t: 0,
    });
  });

  it('최소 이동거리·시간 간격을 못 넘기면 좌표를 버린다', () => {
    const first = appendRouteFix(emptyRouteState, fix(0, 0));
    const tooClose = appendRouteFix(first, fix(5, 2));
    assert.equal(tooClose.points.length, 1);
    assert.equal(tooClose.skipped, 1);

    const movedEnough = appendRouteFix(first, fix(12, 3));
    assert.equal(movedEnough.points.length, 2);

    // 거의 안 움직였어도 최소 시간 간격을 넘기면 한 점은 남깁니다.
    const timeBased = appendRouteFix(first, fix(4, 6));
    assert.equal(timeBased.points.length, 2);
  });

  it('시간이 거꾸로 가거나 좌표가 잘못되면 무시한다', () => {
    const first = appendRouteFix(emptyRouteState, fix(0, 30));
    assert.equal(appendRouteFix(first, fix(50, 10)), first);
    assert.equal(
      appendRouteFix(first, { ...fix(50, 60), latitudeDeg: Number.NaN }),
      first,
    );
  });

  it('상한을 넘으면 균등 간격으로 다운샘플하고 간격 기준을 넓힌다', () => {
    const options = { ...defaultRouteThinningOptions, maxPoints: 8 };
    let state = emptyRouteState;
    for (let index = 0; index < 40; index += 1) {
      state = appendRouteFix(state, fix(index * 20, index * 3), options);
    }
    assert.ok(state.points.length <= options.maxPoints, `${state.points.length}개가 남았습니다`);
    assert.ok(state.downsampleCount >= 1);
    assert.ok(state.spacingScale > 1);
    assert.equal(state.points[0]?.t, 0);
  });

  it('균등 다운샘플은 첫 점과 마지막 점을 지킨다', () => {
    const points = Array.from({ length: 10 }, (_, index) => ({
      lat: 37.5 + index / 10_000,
      lon: 127,
      t: index * 10,
    }));
    const reduced = downsampleRoute(points, 5);
    assert.equal(reduced.length, 5);
    assert.deepEqual(reduced[0], points[0]);
    assert.deepEqual(reduced.at(-1), points.at(-1));
    assert.deepEqual(downsampleRoute(points, 20), points);
  });

  it('좌표가 하나뿐이면 활동 기록에 경로를 넣지 않는다', () => {
    const single = appendRouteFix(emptyRouteState, fix(0, 0));
    assert.equal(routePointsForActivity(single), undefined);

    const two = appendRouteFix(single, fix(30, 10));
    assert.equal(routePointsForActivity(two)?.length, 2);
    assert.equal(defaultRouteThinningOptions.maxPoints, MAX_ACTIVITY_ROUTE_POINTS);
  });

  it('지도 없이 개수만 알려 주는 문구를 만든다', () => {
    assert.equal(routePointSummary(0), '경로 좌표는 아직 없어요.');
    assert.match(routePointSummary(128), /128개/);
  });
});

describe('저장 값 되살리기(기존 기록 호환)', () => {
  it('구간·경로가 없는 예전 기록은 필드 없이 그대로 쓴다', () => {
    const legacy: ActivityRecord = {
      id: 'a1',
      localUuid: 'u1',
      kind: 'run',
      durationMinutes: 30,
      source: 'COACH_COMPLETED',
      completedAt: '2026-07-01T10:00:00.000Z',
      timezoneId: 'Asia/Seoul',
    };
    assert.equal(legacy.splits, undefined);
    assert.equal(legacy.routePoints, undefined);
    assert.equal(sanitizeSplits(undefined), undefined);
    assert.equal(sanitizeRoutePoints(null), undefined);
  });

  it('손상된 항목만 버리고 나머지는 살린다', () => {
    assert.deepEqual(sanitizeSplits([{ km: 1, seconds: 300 }, { km: 'x' }, null]), [
      { km: 1, seconds: 300 },
    ]);
    assert.deepEqual(
      sanitizeRoutePoints([{ lat: 37.5, lon: 127, t: 0 }, { lat: 999, lon: 127, t: 1 }]),
      [{ lat: 37.5, lon: 127, t: 0 }],
    );
  });

  it('상한을 넘는 값은 잘라 낸다', () => {
    const many = Array.from({ length: MAX_ACTIVITY_ROUTE_POINTS + 25 }, (_, index) => ({
      lat: 37.5,
      lon: 127,
      t: index,
    }));
    assert.equal(sanitizeRoutePoints(many)?.length, MAX_ACTIVITY_ROUTE_POINTS);
  });
});

describe('추적 빈 상태·오류 안내', () => {
  const snapshot = (permission: Parameters<typeof trackingSnapshot>[0]['permission']) =>
    trackingSnapshot({
      permission,
      accumulator: emptyTrackAccumulator,
      elapsedSeconds: 60,
      nowMillis: startMillis,
    });

  it('Preview가 아니면 시간 기반 코칭만 한다고 알린다', () => {
    const notice = trackingNotice({
      supported: false,
      permission: 'unsupported',
      signal: 'unavailable',
    });
    assert.equal(notice?.tone, 'info');
    assert.match(notice?.body ?? '', /Preview/);
  });

  it('권한 거부·위치 서비스 꺼짐은 무엇을 하면 되는지 알려 준다', () => {
    const denied = trackingNotice({ supported: true, permission: 'denied', signal: 'unavailable' });
    assert.equal(denied?.tone, 'warning');
    assert.ok((denied?.action ?? '').length > 0);
    assert.match(denied?.body ?? '', /코칭/);

    const off = trackingNotice({
      supported: true,
      permission: 'services-off',
      signal: 'unavailable',
    });
    assert.equal(off?.tone, 'warning');
    assert.ok((off?.action ?? '').length > 0);
  });

  it('신호를 찾는 중·약한 신호를 각각 구분해 안내한다', () => {
    const searching = trackingNotice({
      supported: true,
      permission: 'granted',
      signal: 'searching',
    });
    assert.match(searching?.title ?? '', /찾고/);
    const weak = trackingNotice({ supported: true, permission: 'granted', signal: 'weak' });
    assert.equal(weak?.tone, 'warning');
  });

  it('정상 측정 중에는 안내를 띄우지 않는다', () => {
    assert.equal(
      trackingNotice({ supported: true, permission: 'granted', signal: 'good' }),
      undefined,
    );
    assert.equal(snapshot('granted').measuring, true);
    assert.equal(snapshot('denied').measuring, false);
  });
});

describe('화면 꺼짐 방지 의존성', () => {
  it('SDK 57에 맞춘 expo-keep-awake를 선언한다', () => {
    assert.ok(
      packageJson.dependencies['expo-keep-awake']?.startsWith('~57.0.'),
      `expo-keep-awake 버전이 ${packageJson.dependencies['expo-keep-awake']}입니다`,
    );
  });

  it('백그라운드 위치·지도 의존성을 새로 넣지 않는다', () => {
    const dependencies: Record<string, string | undefined> = packageJson.dependencies;
    for (const forbidden of ['expo-task-manager', 'expo-background-fetch', 'react-native-maps']) {
      assert.equal(dependencies[forbidden], undefined, `${forbidden}가 추가됐습니다`);
    }
  });
});
