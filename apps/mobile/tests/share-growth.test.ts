// 공유한 기록이 러닝봄을 다시 찾는 실제 유입 경로가 되는지 검증합니다.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildShareCard,
  shareCardLandingUrl,
  shareCardText,
} from '../domains/social/shareCard';
import type { ActivityRecord } from '../domains/activities/types';

const activity: ActivityRecord = {
  id: 'run-1',
  localUuid: 'local-test',
  kind: 'run',
  durationMinutes: 30,
  distanceKm: 5,
  source: 'COACH_COMPLETED',
  completedAt: '2026-07-27T09:00:00.000Z',
  timezoneId: 'Asia/Seoul',
};

describe('기록 공유 성장 경로', () => {
  it('공유 글 끝에 누구나 열 수 있는 공식 러닝봄 주소가 한 번 들어간다', () => {
    const text = shareCardText(buildShareCard(activity), '아침 러너');
    assert.ok(shareCardLandingUrl.startsWith('https://'));
    assert.ok(text.includes('러닝봄에서 함께 기록하기'));
    assert.equal(text.split(shareCardLandingUrl).length - 1, 1);
  });

  it('개인 기록과 유입 주소 사이를 줄바꿈으로 분리해 읽기 쉽게 유지한다', () => {
    const text = shareCardText(buildShareCard(activity));
    assert.ok(text.includes("달리기 · 5km · 30분"));
    assert.ok(text.endsWith(shareCardLandingUrl));
    assert.ok(text.includes(`\n\n러닝봄에서 함께 기록하기\n${shareCardLandingUrl}`));
  });
});
