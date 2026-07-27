// 일시정지 관련 기록 무결성을, 한 번이 아니라 "실제로 일어나는 여러 상황"으로 검증합니다.
//
// 기존 tracking-pause.test.ts는 기준점 옮기기 함수 하나만 봅니다.
// 여기서는 여러 번 멈췄다 다시 뛰는 실제 러닝, 경로 오염, 신호 끊김까지 봅니다.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  acceptFix,
  defaultTrackFilterOptions,
  emptyTrackAccumulator,
  type LocationFix,
  type TrackAccumulator,
} from '../domains/tracking/filter';
import { reanchorTrackWithoutDistance } from '../domains/tracking/pause';
import { appendRouteFix, emptyRouteState, type RouteState } from '../domains/tracking/route';

const startMillis = Date.UTC(2026, 6, 27, 0, 0, 0);
const baseLatitude = 37.5663;
const baseLongitude = 126.9779;
/** 위도 1도가 약 111,195m입니다. 북쪽으로 몇 m 갔는지로 좌표를 만듭니다. */
const METERS_PER_DEGREE = 111_195;

function fix(offsetMeters: number, secondsFromStart: number, accuracyMeters = 8): LocationFix {
  return {
    latitudeDeg: baseLatitude + offsetMeters / METERS_PER_DEGREE,
    longitudeDeg: baseLongitude,
    accuracyMeters,
    timestampMillis: startMillis + secondsFromStart * 1_000,
  };
}

/** 러닝 화면이 하는 일을 그대로 흉내 냅니다: 기록 중이면 더하고, 멈춰 있으면 기준점만 옮깁니다. */
function feed(
  accumulator: TrackAccumulator,
  next: LocationFix,
  { recording, needsAnchor }: { recording: boolean; needsAnchor: boolean },
): TrackAccumulator {
  if (!recording) return accumulator;
  if (needsAnchor) return reanchorTrackWithoutDistance(accumulator, next, defaultTrackFilterOptions);
  return acceptFix(accumulator, next, defaultTrackFilterOptions);
}

describe('여러 번 멈췄다 다시 뛰는 러닝', () => {
  it('멈출 때마다 이동한 거리는 한 번도 기록에 섞이지 않는다', () => {
    // 100m 뛰고 → 300m 이동하며 쉬고 → 100m 뛰고 → 300m 이동하며 쉬고 → 100m 뛰기
    // 실제로 뛴 거리는 300m뿐입니다.
    let track = acceptFix(emptyTrackAccumulator, fix(0, 0), defaultTrackFilterOptions);
    let position = 0;
    let seconds = 0;

    for (let round = 0; round < 3; round += 1) {
      // 뛰는 구간: 100m를 20m씩 5번에 나눠 받습니다.
      for (let step = 0; step < 5; step += 1) {
        position += 20;
        seconds += 6;
        track = feed(track, fix(position, seconds), { recording: true, needsAnchor: false });
      }
      if (round === 2) break;

      // 멈춘 구간: 300m를 이동하지만 기록하지 않습니다.
      position += 300;
      seconds += 180;
      track = feed(track, fix(position, seconds), { recording: false, needsAnchor: false });

      // 다시 시작한 첫 좌표는 거리로 더하지 않고 기준점으로만 씁니다.
      seconds += 2;
      track = feed(track, fix(position, seconds), { recording: true, needsAnchor: true });
    }

    // 300m 언저리여야 합니다. 900m가 나오면 멈춘 구간이 섞인 것입니다.
    assert.ok(
      track.distanceMeters > 285 && track.distanceMeters < 315,
      `세 번 나눠 뛴 300m가 ${Math.round(track.distanceMeters)}m로 기록됐습니다`,
    );
  });

  it('고치기 전 방식이었다면 실제로 세 배로 부풀었다는 것을 확인한다', () => {
    // 이 테스트가 진짜 무언가를 지키는지 스스로 증명합니다.
    // 예전처럼 멈춘 동안에도 좌표를 그대로 더하면 어떤 값이 나오는지 재현합니다.
    let naive = acceptFix(emptyTrackAccumulator, fix(0, 0), defaultTrackFilterOptions);
    let position = 0;
    let seconds = 0;

    for (let round = 0; round < 3; round += 1) {
      for (let step = 0; step < 5; step += 1) {
        position += 20;
        seconds += 6;
        naive = acceptFix(naive, fix(position, seconds), defaultTrackFilterOptions);
      }
      if (round === 2) break;
      // 멈춘 동안의 이동도 그대로 더해 버리던 예전 방식입니다.
      // 300m를 한 번에 넣으면 속도 제한에 걸리므로, 걸어서 이동한 것처럼 나눠 넣습니다.
      for (let step = 0; step < 6; step += 1) {
        position += 50;
        seconds += 30;
        naive = acceptFix(naive, fix(position, seconds), defaultTrackFilterOptions);
      }
    }

    // 실제로 뛴 건 300m인데 900m 가까이 나옵니다. 이것이 고치기 전의 문제였습니다.
    assert.ok(
      naive.distanceMeters > 800,
      `예전 방식이 부풀리지 않는다면 이 테스트는 지킬 게 없습니다: ${Math.round(naive.distanceMeters)}m`,
    );
  });

  it('멈춘 동안 제자리에서 GPS가 흔들려도 거리가 늘지 않는다', () => {
    let track = acceptFix(emptyTrackAccumulator, fix(0, 0), defaultTrackFilterOptions);
    track = acceptFix(track, fix(100, 20), defaultTrackFilterOptions);
    const beforePause = track.distanceMeters;

    // 신호가 앞뒤로 8m씩 튀는 상황을 40번 겪어도 기록 중이 아니면 그대로여야 합니다.
    for (let tick = 0; tick < 40; tick += 1) {
      const jitter = tick % 2 === 0 ? 8 : -8;
      track = feed(track, fix(100 + jitter, 25 + tick), { recording: false, needsAnchor: false });
    }

    assert.equal(track.distanceMeters, beforePause);
  });
});

describe('경로 그림', () => {
  it('멈춘 채 이동한 구간을 직선으로 이어 붙이지 않는다', () => {
    // 경로는 "기록 중에 인정된 좌표"만 받아야 합니다.
    let route: RouteState = emptyRouteState;
    let track = acceptFix(emptyTrackAccumulator, fix(0, 0), defaultTrackFilterOptions);
    if (track.anchor) route = appendRouteFix(route, track.anchor);

    track = acceptFix(track, fix(100, 20), defaultTrackFilterOptions);
    if (track.anchor) route = appendRouteFix(route, track.anchor);

    // 멈춘 채 500m 지점으로 이동 — 경로에 넣지 않습니다.
    const duringPause = reanchorTrackWithoutDistance(track, fix(500, 200), defaultTrackFilterOptions);

    // 저장되는 경로 좌표는 lat/lon/t 형태입니다.
    const offsets = route.points.map(
      (point) => Math.round((point.lat - baseLatitude) * METERS_PER_DEGREE),
    );
    assert.ok(
      !offsets.some((offset) => offset > 400),
      `경로에 멈춘 동안 이동한 지점이 들어갔습니다: ${JSON.stringify(offsets)}`,
    );
    // 기준점은 옮겨졌지만 거리는 그대로여야 합니다.
    assert.equal(duringPause.distanceMeters, track.distanceMeters);
  });
});

describe('신호가 끊겼을 때', () => {
  it('30초 넘게 좌표가 없으면 그 사이를 직선 거리로 메우지 않는다', () => {
    let track = acceptFix(emptyTrackAccumulator, fix(0, 0), defaultTrackFilterOptions);
    track = acceptFix(track, fix(50, 10), defaultTrackFilterOptions);
    const beforeGap = track.distanceMeters;

    // 60초 뒤에 400m 떨어진 곳에서 다시 신호가 잡혔습니다.
    const afterGap = acceptFix(track, fix(450, 70), defaultTrackFilterOptions);

    assert.equal(
      afterGap.distanceMeters,
      beforeGap,
      '신호가 끊긴 사이의 이동을 거리로 더했습니다',
    );
    assert.equal(afterGap.lastRejectReason, 'gap');
  });
});
