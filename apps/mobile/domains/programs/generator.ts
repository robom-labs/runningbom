// 계획을 "손으로 쓴 표"가 아니라 규칙으로 만들어 냅니다.
//
// 왜 이렇게 하는가:
//   계획이 100개 필요한데 표를 100개 손으로 쓰면 유지가 불가능하고,
//   경쟁 앱의 주차표를 베끼는 것은 저작권상으로도 제품상으로도 하면 안 됩니다.
//   대신 "어디서 시작해 어디로 가는가"를 입력으로 받아 회차를 계산합니다.
//
// 안전 규칙(V3 §11.4)은 계산 안에 넣어 두었습니다.
//   - 0초·음수 구간을 만들지 않습니다.
//   - 4주마다 한 번은 가볍게 가는 주(회복 주)를 넣습니다.
//   - 마지막 주는 부담을 줄입니다.
//   - 같은 입력이면 언제나 같은 결과가 나옵니다(결정적).
import {
  formatDuration,
  type ProgramSession,
  type ProgramWeek,
  type RunProgram,
  type SegmentKind,
  type SessionSegment,
} from './types';

/** 준비·마무리 걷기 길이입니다. 모든 회차에 똑같이 붙습니다. */
export const WARMUP_SECONDS = 300;
export const COOLDOWN_SECONDS = 300;

/** 네 주에 한 번은 늘리지 않고 가볍게 갑니다. */
const CUTBACK_EVERY = 4;

/**
 * 한 주에 뛰는 시간을 이보다 많이 늘리지 않습니다.
 * 이 앱이 이미 쓰는 부상 안내(2주에 30% 증가 경고)와 같은 방향입니다.
 */
const MAX_WEEKLY_GROWTH_RATIO = 0.3;
/** 다만 아주 짧은 계획에서는 퍼센트가 가혹하므로, 이 시간 안쪽이면 허용합니다. */
const MAX_WEEKLY_GROWTH_SECONDS = 300;
/** 한 회차 길이의 상한입니다. 이보다 길면 초보가 끝까지 하지 못합니다. */
const MAX_SESSION_SECONDS = 90 * 60;

export type PlanRecipe = {
  /** 저장·복원에 쓰는 고유 ID입니다. 한 번 정하면 바꾸지 않습니다. */
  id: string;
  name: string;
  subtitle: string;
  description: string;
  /** 1주차에 한 번에 뛰는 시간(초)입니다. */
  startRunSeconds: number;
  /** 마지막 주에 한 번에 뛰는 시간(초)입니다. */
  endRunSeconds: number;
  /**
   * 1주차 한 회차에서 "뛰는 시간의 합"입니다.
   * 반복 횟수를 따로 받지 않고 이 값에서 계산합니다.
   * 반복과 구간 길이를 따로 늘리면 부하가 곱으로 폭발하기 때문입니다.
   */
  startTotalRunSeconds: number;
  /** 마지막 주 한 회차의 뛰는 시간 합입니다. */
  endTotalRunSeconds: number;
  /** 뛰고 나서 걷는 시간의 비율입니다. 1이면 뛴 만큼 걷습니다. */
  walkRatio: number;
  weeks: number;
  daysPerWeek: number;
};

/** 0으로 나누기와 음수를 막고, 5초 단위로 다듬습니다(말하기 좋은 숫자). */
function roundStep(seconds: number): number {
  return Math.max(5, Math.round(seconds / 5) * 5);
}

/**
 * 1주차에서 마지막 주까지 값을 부드럽게 잇습니다.
 * 회복 주에는 직전 주보다 늘리지 않고 한 걸음 물러섭니다.
 */
function progressAt(start: number, end: number, week: number, weeks: number): number {
  if (weeks <= 1) return end;
  const ratio = (week - 1) / (weeks - 1);
  const base = start + (end - start) * ratio;
  // 회복 주는 직전 주 수준으로 되돌립니다(늘리지 않습니다).
  // 마지막 주는 회복 주가 아니라 '목표에 도달하는 주'이므로 여기서 빼야 합니다.
  if (isCutbackWeek(week, weeks)) {
    const previousRatio = (week - 2) / (weeks - 1);
    return start + (end - start) * previousRatio;
  }
  return base;
}

/** 이 주가 가볍게 가는 주인지입니다. */
export function isCutbackWeek(week: number, weeks: number): boolean {
  return week > 1 && week < weeks && week % CUTBACK_EVERY === 0;
}

function segment(
  id: string,
  kind: SegmentKind,
  role: SessionSegment['role'],
  seconds: number,
): SessionSegment {
  return { id, kind, role, seconds, label: kind === 'run' ? '뛰기' : '걷기' };
}

/** 한 회차의 구간을 만듭니다. 준비 걷기 → 본운동 → 마무리 걷기입니다. */
function buildSegments(
  sessionId: string,
  runSeconds: number,
  walkSeconds: number,
  reps: number,
): SessionSegment[] {
  const segments: SessionSegment[] = [
    segment(`${sessionId}-warmup`, 'walk', 'warmup', WARMUP_SECONDS),
  ];
  for (let index = 0; index < reps; index += 1) {
    segments.push(segment(`${sessionId}-run-${index}`, 'run', 'main', runSeconds));
    // 마지막 반복 뒤에는 회복 걷기를 넣지 않습니다. 바로 마무리 걷기로 이어집니다.
    if (index < reps - 1) {
      segments.push(segment(`${sessionId}-walk-${index}`, 'walk', 'main', walkSeconds));
    }
  }
  segments.push(segment(`${sessionId}-cooldown`, 'walk', 'cooldown', COOLDOWN_SECONDS));
  return segments;
}

function summarize(runSeconds: number, walkSeconds: number, reps: number): string {
  if (reps === 1) return `${formatDuration(runSeconds)} 이어서 뛰어요.`;
  return `뛰기 ${formatDuration(runSeconds)} + 걷기 ${formatDuration(walkSeconds)}를 ${reps}번 반복해요.`;
}

function weekFocus(week: number, weeks: number, reps: number, runSeconds: number): string {
  if (isCutbackWeek(week, weeks)) {
    return '이번 주는 늘리지 않고 가볍게 가요. 회복도 훈련이에요.';
  }
  if (week === weeks) return '마지막 주예요. 무리하지 말고 지금까지 한 대로 해요.';
  if (reps === 1) return `${formatDuration(runSeconds)}을 쉬지 않고 이어 가는 것이 목표예요.`;
  return `한 번에 ${formatDuration(runSeconds)}씩 뛰는 데 익숙해지는 주예요.`;
}

/**
 * 규칙으로 계획 하나를 만듭니다.
 * 같은 recipe를 넣으면 언제나 같은 결과가 나옵니다.
 */
export function generatePlan(recipe: PlanRecipe): RunProgram {
  const weeks: ProgramWeek[] = [];
  const allSessions: ProgramSession[] = [];

  for (let week = 1; week <= recipe.weeks; week += 1) {
    // 순서가 중요합니다.
    // 몸이 받는 부담은 "이번 주에 뛰는 시간의 합"이므로 그것부터 매끄럽게 정하고,
    // 반복 횟수와 한 구간 길이를 거기에 맞춥니다.
    // (구간 길이를 먼저 정하고 반복을 반올림하면 실제 부하가 들쭉날쭉해집니다.)
    const totalRunTarget = progressAt(
      recipe.startTotalRunSeconds,
      recipe.endTotalRunSeconds,
      week,
      recipe.weeks,
    );
    const desiredInterval = progressAt(
      recipe.startRunSeconds,
      recipe.endRunSeconds,
      week,
      recipe.weeks,
    );
    const reps = Math.max(1, Math.round(totalRunTarget / Math.max(1, desiredInterval)));
    // 반복 횟수가 정해졌으면 구간 길이를 다시 계산해 실제 합이 목표를 따라가게 합니다.
    const runSeconds = roundStep(totalRunTarget / reps);
    const walkSeconds = roundStep(runSeconds * recipe.walkRatio);

    const sessions: ProgramSession[] = [];
    for (let day = 1; day <= recipe.daysPerWeek; day += 1) {
      const id = `${recipe.id}-w${week}d${day}`;
      const segments = buildSegments(id, runSeconds, walkSeconds, reps);
      const totalSeconds = segments.reduce((sum, item) => sum + item.seconds, 0);
      const runTotal = segments
        .filter((item) => item.kind === 'run')
        .reduce((sum, item) => sum + item.seconds, 0);
      // 한 번에 이어 뛰는 시간이 처음으로 늘어나는 주의 첫날을 고비로 봅니다.
      const isMilestone = day === 1 && reps === 1 && week > 1;
      const session: ProgramSession = {
        id,
        week,
        day,
        title: `${week}주 ${day}일차`,
        summary: summarize(runSeconds, walkSeconds, reps),
        segments,
        totalSeconds,
        runSeconds: runTotal,
        isMilestone,
        ...(isMilestone
          ? { encouragement: '여기까지 온 것만으로 충분히 잘하고 있어요. 천천히 가도 괜찮아요.' }
          : {}),
      };
      sessions.push(session);
      allSessions.push(session);
    }

    weeks.push({
      week,
      title: `${week}주차`,
      focus: weekFocus(week, recipe.weeks, reps, runSeconds),
      sessions,
    });
  }

  return {
    id: recipe.id,
    name: recipe.name,
    subtitle: recipe.subtitle,
    description: recipe.description,
    runsPerWeek: recipe.daysPerWeek,
    restNote: '회차 사이에는 하루 쉬어요. 쉬는 날도 계획의 일부예요.',
    weeks,
    sessions: allSessions,
  };
}

/**
 * 만들어진 계획이 안전 규칙을 지키는지 확인합니다.
 * 문제가 있으면 사람이 읽을 수 있는 이유를 돌려줍니다(빈 배열이면 통과).
 */
export function validatePlan(plan: RunProgram): string[] {
  const problems: string[] = [];
  const seenIds = new Set<string>();

  if (plan.weeks.length === 0) problems.push('주차가 하나도 없습니다.');

  for (const session of plan.sessions) {
    if (seenIds.has(session.id)) problems.push(`회차 ID가 겹칩니다: ${session.id}`);
    seenIds.add(session.id);

    if (session.segments.length === 0) problems.push(`${session.id}: 구간이 없습니다.`);
    for (const item of session.segments) {
      if (!Number.isFinite(item.seconds) || item.seconds <= 0) {
        problems.push(`${session.id}: ${item.id} 길이가 ${item.seconds}초입니다.`);
      }
    }
    const sum = session.segments.reduce((total, item) => total + item.seconds, 0);
    if (sum !== session.totalSeconds) {
      problems.push(`${session.id}: 구간 합(${sum})과 전체(${session.totalSeconds})가 다릅니다.`);
    }
    // 준비·마무리 걷기가 빠지면 몸이 놀랍니다.
    if (session.segments[0]?.role !== 'warmup') problems.push(`${session.id}: 준비 걷기가 없습니다.`);
    if (session.segments.at(-1)?.role !== 'cooldown') {
      problems.push(`${session.id}: 마무리 걷기가 없습니다.`);
    }
  }

  // 계획이 4주보다 길면 회복 주가 최소 하나는 있어야 합니다.
  if (plan.weeks.length > CUTBACK_EVERY) {
    const hasCutback = plan.weeks.some((week) => isCutbackWeek(week.week, plan.weeks.length));
    if (!hasCutback) problems.push('4주가 넘는데 가볍게 가는 주가 없습니다.');
  }

  // 주마다 뛰는 시간이 얼마나 늘어나는지 봅니다.
  // 퍼센트만 보면 짧은 계획(10분 -> 13분)이 억울하게 걸리므로,
  // "30%를 넘더라도 5분 이내면 괜찮다"는 절대 기준을 같이 씁니다.
  for (let index = 1; index < plan.weeks.length; index += 1) {
    const before = plan.weeks[index - 1].sessions[0]?.runSeconds ?? 0;
    const after = plan.weeks[index].sessions[0]?.runSeconds ?? 0;
    if (before <= 0 || after <= before) continue;
    const growthRatio = (after - before) / before;
    const growthSeconds = after - before;
    if (growthRatio > MAX_WEEKLY_GROWTH_RATIO && growthSeconds > MAX_WEEKLY_GROWTH_SECONDS) {
      problems.push(
        `${index + 1}주차에 뛰는 시간이 ${Math.round(before / 60)}분에서 ` +
          `${Math.round(after / 60)}분으로 한 번에 너무 많이 늘어납니다.`,
      );
    }
  }

  // 한 회차가 지나치게 길면 초보가 끝까지 하지 못합니다.
  for (const session of plan.sessions) {
    if (session.totalSeconds > MAX_SESSION_SECONDS) {
      problems.push(
        `${session.id}: 한 회차가 ${Math.round(session.totalSeconds / 60)}분으로 너무 깁니다.`,
      );
    }
  }

  // 뛰는 시간이 주차를 거치며 줄기만 하면 계획이 아닙니다.
  const firstRun = plan.weeks[0]?.sessions[0]?.runSeconds ?? 0;
  const lastRun = plan.weeks.at(-1)?.sessions[0]?.runSeconds ?? 0;
  if (plan.weeks.length > 1 && lastRun < firstRun) {
    problems.push('마지막 주가 첫 주보다 적게 뜁니다.');
  }

  return problems;
}
