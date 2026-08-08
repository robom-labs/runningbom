// 풀토크를 추정 합계가 아닌 실제 겹침을 합친 시간축으로 회귀 검사합니다.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createCoachSession,
  createCoachSessionForExtent,
  withLongform,
} from '../domains/coaching/model';
import { auditCoachTimeline } from '../domains/coaching/timelineAudit';

const durationMatrix = [3, 5, 10, 20, 30, 49, 50, 51, 60, 90, 119, 120, 121, 180, 360, 720];

test('풀토크 전 시간 행렬이 점유율과 최대 무음 계약을 만족합니다', () => {
  for (const minutes of durationMatrix) {
    const session = withLongform(createCoachSession('이지런', minutes, 'detailed'), 'full-talk');
    const audit = auditCoachTimeline(session);
    assert.ok(
      audit.occupancy >= 0.75,
      `${minutes}분 점유율이 ${audit.occupancy.toFixed(3)}입니다`,
    );
    assert.ok(
      audit.occupancy <= 0.95,
      `${minutes}분 점유율이 ${audit.occupancy.toFixed(3)}로 과도합니다`,
    );
    assert.ok(
      audit.maxSilenceSeconds <= 6,
      `${minutes}분 최대 무음이 ${audit.maxSilenceSeconds.toFixed(2)}초입니다`,
    );
    assert.equal(
      audit.nearbyDuplicateTexts,
      0,
      `${minutes}분 대사표에서 최근 4개 이내 같은 문장이 반복됐습니다`,
    );
  }
});

test('끝을 정하지 않은 12시간 대사표에는 거짓 종료 안내가 없습니다', () => {
  const openEnded = createCoachSessionForExtent(
    '이지런',
    { type: 'open-ended' },
    'detailed',
    720,
  );
  const session = withLongform(openEnded, 'full-talk');
  const audit = auditCoachTimeline(session);
  assert.ok(audit.occupancy >= 0.75, `점유율 ${audit.occupancy.toFixed(3)}`);
  assert.ok(audit.maxSilenceSeconds <= 6, `최대 무음 ${audit.maxSilenceSeconds.toFixed(2)}초`);
  assert.equal(audit.nearbyDuplicateTexts, 0);
  assert.equal(
    session.cues.some((cue) => cue.kind === 'completion' || cue.kind === 'progress'),
    false,
  );
});
