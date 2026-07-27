// 회차를 끝냈을 때 "다음으로 넘어가도 되는지"를 정하는 규칙과, 프로그램 전체 진행 상태입니다.
//
// 다른 앱들은 시간만 흐르면 다음 회차를 열어 줍니다. 러닝봄은 얼마나 채웠는지(완주율)로 봅니다.
// 80% 이상이면 완료로 보고, 그보다 적으면 "한 번 더 해볼까요?"라고 권합니다. 막지는 않습니다.
import { beginnerProgram } from './beginnerProgram';
import type { ProgramSession, ProgramWeek, RunProgram } from './types';
import { formatDuration } from './types';

/** 완료로 보는 기준입니다. 0.8 = 80% */
export const PASS_RATIO = 0.8;

export type SessionAttempt = {
  sessionId: string;
  /** 실제로 채운 시간(초) */
  completedSeconds: number;
  /** 그 회차의 전체 시간(초) */
  totalSeconds: number;
  /** 언제 했는지(ISO 문자열) */
  finishedAt: string;
};

export function completionRatio(completedSeconds: number, totalSeconds: number): number {
  if (!Number.isFinite(completedSeconds) || !Number.isFinite(totalSeconds)) return 0;
  if (totalSeconds <= 0) return 0;
  return Math.min(1, Math.max(0, completedSeconds / totalSeconds));
}

export type SessionVerdict = {
  ratio: number;
  /** 0~100 정수 */
  percent: number;
  passed: boolean;
  title: string;
  message: string;
  /** 권하는 행동(큰 버튼) */
  primaryLabel: string;
  /** 다른 선택(작은 버튼) */
  secondaryLabel: string;
  /** 같은 회차를 한 번 더 하길 권하는지입니다. */
  suggestRepeat: boolean;
  /**
   * 기준에 못 미쳐도 사용자가 다음 회차로 갈 수 있습니다. 항상 true입니다.
   * 앱이 사람을 막지 않기 위한 값이에요.
   */
  canAdvance: true;
};

export function judgeSession(input: {
  completedSeconds: number;
  totalSeconds: number;
  isMilestone?: boolean;
}): SessionVerdict {
  const ratio = completionRatio(input.completedSeconds, input.totalSeconds);
  const percent = Math.round(ratio * 100);
  const passed = ratio >= PASS_RATIO;
  if (passed) {
    return {
      ratio,
      percent,
      passed,
      title: input.isMilestone === true ? '고비를 넘겼어요!' : '오늘 회차 완료!',
      message:
        input.isMilestone === true
          ? `오늘 걸 ${percent}% 채웠어요. 가장 어려운 날을 해냈어요. 다음 회차로 넘어가요.`
          : `오늘 걸 ${percent}% 채웠어요. 다음 회차로 넘어가요.`,
      primaryLabel: '다음 회차로',
      secondaryLabel: '같은 회차 한 번 더',
      suggestRepeat: false,
      canAdvance: true,
    };
  }
  return {
    ratio,
    percent,
    passed,
    title: '여기까지도 잘했어요',
    message: `오늘 걸 ${percent}% 채웠어요. ${Math.round(
      PASS_RATIO * 100,
    )}%를 넘으면 다음으로 넘어가기 좋아요. 한 번 더 해볼까요?`,
    primaryLabel: '같은 회차 한 번 더',
    secondaryLabel: '그래도 다음 회차로',
    suggestRepeat: true,
    canAdvance: true,
  };
}

export type ProgramProgress = {
  program: RunProgram;
  completedCount: number;
  totalCount: number;
  /** 0~1 */
  ratio: number;
  percent: number;
  finished: boolean;
  /** 다음에 할 회차입니다. 다 끝났으면 없습니다. */
  current?: ProgramSession;
  currentWeek?: ProgramWeek;
  /** 예: "3주 2일차" — 다 끝났으면 "모두 마쳤어요" */
  positionLabel: string;
  /** 예: "다음 회차 · 3주 2일차 · 28분" */
  nextLabel: string;
  /** 이번 주에 몇 회차를 마쳤는지입니다. */
  weekDoneCount: number;
};

export function programProgress(
  completedIds: string[],
  program: RunProgram = beginnerProgram,
): ProgramProgress {
  const done = new Set(completedIds);
  const completedCount = program.sessions.filter((session) => done.has(session.id)).length;
  const totalCount = program.sessions.length;
  const current = program.sessions.find((session) => !done.has(session.id));
  const currentWeek = current
    ? program.weeks.find((week) => week.week === current.week)
    : undefined;
  const ratio = totalCount > 0 ? completedCount / totalCount : 0;
  const weekDoneCount = currentWeek
    ? currentWeek.sessions.filter((session) => done.has(session.id)).length
    : program.runsPerWeek;
  return {
    program,
    completedCount,
    totalCount,
    ratio,
    percent: Math.round(ratio * 100),
    finished: current === undefined,
    ...(current ? { current } : {}),
    ...(currentWeek ? { currentWeek } : {}),
    positionLabel: current ? current.title : '모두 마쳤어요',
    nextLabel: current
      ? `다음 회차 · ${current.title} · ${formatDuration(current.totalSeconds)}`
      : '9주를 모두 끝냈어요. 이제 대회를 목표로 잡아 볼까요?',
    weekDoneCount,
  };
}

/** 목록 카드에 쓰는 한 줄 안내입니다. */
export function progressSummary(progress: ProgramProgress): string {
  if (progress.completedCount === 0) return '아직 시작 전이에요. 첫 회차는 30분이에요.';
  if (progress.finished) return `${progress.totalCount}회차를 모두 마쳤어요.`;
  return `${progress.totalCount}회차 중 ${progress.completedCount}회차를 마쳤어요.`;
}
