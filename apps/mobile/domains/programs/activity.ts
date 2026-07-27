// 9주 프로그램 회차를 러닝봄의 공통 활동 기록으로 바꾸는 순수 규칙입니다.
// 프로그램 진행 저장과 활동 저장은 서로 다른 저장소를 쓰지만, 사용자가 실제로 움직인 기록은
// 홈·주간 목표·연속 기록·배지에도 한 번만 반영되어야 합니다.
import type { ActivityKind, ActivityRecord } from '../activities/types';
import type { SessionAttempt } from './progress';
import type { ProgramSession } from './types';

/** 실수로 몇 초 켰다가 끈 회차는 운동 기록으로 만들지 않습니다. */
export const PROGRAM_ACTIVITY_MIN_SECONDS = 5 * 60;

export type ProgramActivityDraft = Pick<
  ActivityRecord,
  'id' | 'kind' | 'durationMinutes' | 'source' | 'completedAt'
>;

function validIsoDate(value: string): boolean {
  return value.trim().length > 0 && Number.isFinite(Date.parse(value));
}

/**
 * 실제로 채운 프로그램 시간을 공통 활동 기록 입력으로 바꿉니다.
 * - 다른 회차의 시도는 섞지 않습니다.
 * - 전체 시간보다 큰 값은 회차 전체 시간으로 줄입니다.
 * - 뛰는 구간이 하나라도 있으면 달리기, 전부 걷기면 걷기로 기록합니다.
 * - 같은 완료 버튼이 두 번 눌려도 같은 id를 만들어 중복 저장을 막습니다.
 */
export function activityFromProgramAttempt(
  session: ProgramSession,
  attempt: SessionAttempt,
): ProgramActivityDraft | undefined {
  if (attempt.sessionId !== session.id || !validIsoDate(attempt.finishedAt)) return undefined;

  const completedSeconds = Math.min(
    Math.max(0, Number.isFinite(attempt.completedSeconds) ? attempt.completedSeconds : 0),
    Math.max(0, Number.isFinite(attempt.totalSeconds) ? attempt.totalSeconds : 0),
    Math.max(0, Number.isFinite(session.totalSeconds) ? session.totalSeconds : 0),
  );
  if (completedSeconds < PROGRAM_ACTIVITY_MIN_SECONDS) return undefined;

  const kind: ActivityKind = session.runSeconds > 0 ? 'run' : 'walk';
  return {
    id: `program:${session.id}:${attempt.finishedAt}`,
    kind,
    durationMinutes: Math.max(1, Math.round(completedSeconds / 60)),
    source: 'COACH_COMPLETED',
    completedAt: attempt.finishedAt,
  };
}
