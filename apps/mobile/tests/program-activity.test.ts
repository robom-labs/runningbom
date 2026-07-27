// 9주 프로그램 완료가 홈·목표·배지에서 쓰는 공통 활동 기록으로 정확히 이어지는지 검증합니다.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  activityFromProgramAttempt,
  PROGRAM_ACTIVITY_MIN_SECONDS,
} from '../domains/programs/activity';
import type { SessionAttempt } from '../domains/programs/progress';
import type { ProgramSession } from '../domains/programs/types';

function session(overrides: Partial<ProgramSession> = {}): ProgramSession {
  return {
    id: 'week-1-day-1',
    week: 1,
    day: 1,
    title: '1주 1일차',
    summary: '걷기와 뛰기를 번갈아 해요',
    segments: [
      { id: 'warmup', kind: 'walk', role: 'warmup', seconds: 300, label: '걷기' },
      { id: 'run', kind: 'run', role: 'main', seconds: 1_200, label: '뛰기' },
      { id: 'cooldown', kind: 'walk', role: 'cooldown', seconds: 300, label: '걷기' },
    ],
    totalSeconds: 1_800,
    runSeconds: 1_200,
    isMilestone: false,
    ...overrides,
  };
}

function attempt(overrides: Partial<SessionAttempt> = {}): SessionAttempt {
  return {
    sessionId: 'week-1-day-1',
    completedSeconds: 1_800,
    totalSeconds: 1_800,
    finishedAt: '2026-07-27T10:20:30.000Z',
    ...overrides,
  };
}

describe('프로그램 회차 → 활동 기록', () => {
  it('뛰는 구간이 있는 완료 회차를 달리기 활동으로 만든다', () => {
    assert.deepEqual(activityFromProgramAttempt(session(), attempt()), {
      id: 'program:week-1-day-1:2026-07-27T10:20:30.000Z',
      kind: 'run',
      durationMinutes: 30,
      source: 'COACH_COMPLETED',
      completedAt: '2026-07-27T10:20:30.000Z',
    });
  });

  it('실수로 잠깐 연 회차는 활동으로 만들지 않는다', () => {
    assert.equal(
      activityFromProgramAttempt(
        session(),
        attempt({ completedSeconds: PROGRAM_ACTIVITY_MIN_SECONDS - 1 }),
      ),
      undefined,
    );
  });

  it('회차 ID가 다르거나 완료 시각이 잘못되면 섞지 않는다', () => {
    assert.equal(
      activityFromProgramAttempt(session(), attempt({ sessionId: 'week-2-day-1' })),
      undefined,
    );
    assert.equal(
      activityFromProgramAttempt(session(), attempt({ finishedAt: 'not-a-date' })),
      undefined,
    );
  });

  it('과도한 경과값은 프로그램 전체 시간으로 줄여 기록한다', () => {
    const result = activityFromProgramAttempt(
      session(),
      attempt({ completedSeconds: 99_999, totalSeconds: 99_999 }),
    );
    assert.equal(result?.durationMinutes, 30);
  });

  it('뛰는 구간이 없는 회차는 걷기로 기록한다', () => {
    const walkSession = session({
      id: 'recovery-walk',
      segments: [
        { id: 'walk', kind: 'walk', role: 'main', seconds: 600, label: '걷기' },
      ],
      totalSeconds: 600,
      runSeconds: 0,
    });
    const result = activityFromProgramAttempt(
      walkSession,
      attempt({ sessionId: 'recovery-walk', completedSeconds: 600, totalSeconds: 600 }),
    );
    assert.equal(result?.kind, 'walk');
    assert.equal(result?.durationMinutes, 10);
  });
});
