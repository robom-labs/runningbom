// 화면 fallback 코칭이 실제 시간 전에는 완주로 처리되지 않는지 검증합니다.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  pauseFallbackClock,
  resumeFallbackClock,
  snapshotFallbackClock,
  startFallbackClock,
  stopFallbackClock,
} from '../domains/coaching/fallbackClock';

const startedAt = Date.UTC(2026, 6, 26, 0, 0, 0);

function runningClock() {
  return startFallbackClock(
    {
      sessionId: 'session-1',
      definitionId: '편안한 지속주:10:standard',
      title: '편안한 지속주',
      countsAs: 'run',
      durationSeconds: 600,
    },
    startedAt,
  );
}

test('fallback 코칭은 시작 직후 완료되지 않는다', () => {
  const snapshot = snapshotFallbackClock(runningClock(), startedAt + 5_000);
  assert.equal(snapshot.state, 'running');
  assert.equal(snapshot.elapsedSeconds, 5);
  assert.equal(snapshot.completedAtEpochMillis, undefined);
});

test('fallback 코칭은 일시정지 시간을 경과 시간에 포함하지 않는다', () => {
  const paused = pauseFallbackClock(runningClock(), startedAt + 120_000);
  const stillPaused = snapshotFallbackClock(paused, startedAt + 420_000);
  const resumed = resumeFallbackClock(stillPaused, startedAt + 420_000);
  const snapshot = snapshotFallbackClock(resumed, startedAt + 480_000);

  assert.equal(snapshot.state, 'running');
  assert.equal(snapshot.elapsedSeconds, 180);
});

test('fallback 코칭은 예정 시간을 채운 뒤에만 완료된다', () => {
  const snapshot = snapshotFallbackClock(runningClock(), startedAt + 600_000);
  assert.equal(snapshot.state, 'completed');
  assert.equal(snapshot.elapsedSeconds, 600);
  assert.equal(snapshot.completedAtEpochMillis, startedAt + 600_000);
});

test('fallback 코칭을 일찍 종료하면 완료가 아닌 중단 상태다', () => {
  const stopped = stopFallbackClock(runningClock(), startedAt + 90_000);
  assert.equal(stopped.state, 'stopped');
  assert.equal(stopped.elapsedSeconds, 90);
  assert.equal(stopped.completedAtEpochMillis, undefined);
});
