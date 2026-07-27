// 오늘 한 번만 하는 훈련입니다.
//
// 계획(9주 프로그램, 40개 계획)은 "몇 주에 걸쳐 몸을 바꾸는 것"이고,
// 여기 있는 것은 "오늘 나가서 한 번 하고 끝나는 것"입니다.
// 계획에 가입하지 않아도 되고, 진도가 밀리지도 않습니다.
//
// 왜 필요한가:
//   계획을 하다가도 "오늘은 30분만 가볍게" 같은 날이 있습니다.
//   그때 계획 회차를 억지로 당겨 쓰면 진도가 꼬입니다.
//   이 층이 있으면 계획을 건드리지 않고 오늘 하루만 해결합니다.
//
// 중요:
//   여기서 만든 훈련은 프로그램 회차(ProgramSession)와 **같은 모양**입니다.
//   그래서 회차 화면·음성·시간·구간 띠를 그대로 씁니다. 새 엔진을 만들지 않습니다.
import { levelRank, type UserLevelId } from '../programs/level';
import {
  formatDuration,
  type ProgramSession,
  type SegmentKind,
  type SessionSegment,
} from '../programs/types';

/** 훈련의 큰 갈래입니다. 화면의 칸 이름과 짝을 이룹니다. */
export type WorkoutCategory =
  | 'EASY'
  | 'REPEAT'
  | 'FAST'
  | 'LONG'
  | 'HILL'
  | 'WALK'
  | 'TREADMILL'
  | 'RECOVERY'
  | 'SHORT'
  | 'LADDER'
  | 'CHECK';

export const workoutCategoryLabels: Record<WorkoutCategory, string> = {
  EASY: '편하게',
  REPEAT: '걷고 뛰기',
  FAST: '조금 빠르게',
  LONG: '길게',
  HILL: '오르막',
  WALK: '걷기',
  TREADMILL: '러닝머신',
  RECOVERY: '회복',
  SHORT: '짧게',
  LADDER: '늘렸다 줄이기',
  CHECK: '지금 내 상태 보기',
};

/**
 * 훈련의 모양입니다.
 * 준비 걷기와 마무리 걷기는 모든 훈련에 똑같이 붙으므로 여기 넣지 않습니다.
 */
export type WorkoutShape =
  /** 쉬지 않고 이어 갑니다. */
  | { kind: 'steady'; runSeconds: number }
  /** 뛰기와 걷기를 번갈아 합니다. */
  | { kind: 'repeat'; runSeconds: number; walkSeconds: number; reps: number }
  /** 처음부터 끝까지 걷습니다. */
  | { kind: 'walk'; walkSeconds: number }
  /** 뛰는 시간을 늘렸다가 다시 줄입니다. */
  | { kind: 'ladder'; runSteps: number[]; walkSeconds: number };

export type WorkoutTemplate = {
  /** 저장·기록에 쓰는 고유 ID입니다. 한 번 정하면 바꾸지 않습니다. */
  id: string;
  title: string;
  subtitle: string;
  description: string;
  category: WorkoutCategory;
  /** 이 수준 아래로는 보여 주지 않습니다. */
  minLevel: UserLevelId;
  shape: WorkoutShape;
  warmupSeconds: number;
  cooldownSeconds: number;
};

/** 준비·마무리 걷기의 기본값입니다. */
const WARMUP = 300;
const COOLDOWN = 300;
/** 아주 짧은 훈련은 준비·마무리도 짧게 둡니다. 20분 훈련에 10분 걷기는 어색합니다. */
const SHORT_WARMUP = 180;
const SHORT_COOLDOWN = 180;
/** 한 훈련의 상한입니다. 이보다 길면 하루 훈련이 아닙니다. */
export const MAX_WORKOUT_SECONDS = 100 * 60;

function segment(
  id: string,
  kind: SegmentKind,
  role: SessionSegment['role'],
  seconds: number,
): SessionSegment {
  return { id, kind, role, seconds, label: kind === 'run' ? '뛰기' : '걷기' };
}

/** 훈련의 본운동 구간을 만듭니다. */
function mainSegments(id: string, shape: WorkoutShape): SessionSegment[] {
  if (shape.kind === 'steady') {
    return [segment(`${id}-run`, 'run', 'main', shape.runSeconds)];
  }
  if (shape.kind === 'walk') {
    return [segment(`${id}-walk`, 'walk', 'main', shape.walkSeconds)];
  }
  if (shape.kind === 'repeat') {
    const out: SessionSegment[] = [];
    for (let index = 0; index < shape.reps; index += 1) {
      out.push(segment(`${id}-run-${index}`, 'run', 'main', shape.runSeconds));
      // 마지막 뛰기 뒤에는 회복 걷기를 넣지 않습니다. 바로 마무리 걷기로 이어집니다.
      if (index < shape.reps - 1) {
        out.push(segment(`${id}-rest-${index}`, 'walk', 'main', shape.walkSeconds));
      }
    }
    return out;
  }
  const out: SessionSegment[] = [];
  shape.runSteps.forEach((seconds, index) => {
    out.push(segment(`${id}-step-${index}`, 'run', 'main', seconds));
    if (index < shape.runSteps.length - 1) {
      out.push(segment(`${id}-rest-${index}`, 'walk', 'main', shape.walkSeconds));
    }
  });
  return out;
}

/** 오늘 무엇을 하는지 한 줄로 알려 주는 말입니다. */
export function workoutSummary(shape: WorkoutShape): string {
  if (shape.kind === 'steady') return `${formatDuration(shape.runSeconds)} 이어서 뛰어요.`;
  if (shape.kind === 'walk') return `${formatDuration(shape.walkSeconds)} 동안 걸어요.`;
  if (shape.kind === 'repeat') {
    return `뛰기 ${formatDuration(shape.runSeconds)} + 걷기 ${formatDuration(
      shape.walkSeconds,
    )}를 ${shape.reps}번 반복해요.`;
  }
  const steps = shape.runSteps.map((seconds) => formatDuration(seconds)).join(' → ');
  return `${steps} 순서로 뛰고, 사이사이 ${formatDuration(shape.walkSeconds)} 걸어요.`;
}

/**
 * 훈련 하나를 회차 모양으로 바꿉니다.
 * 이 값을 그대로 회차 화면에 넘기면 음성·구간 띠·시간이 전부 동작합니다.
 */
export function buildWorkoutSession(template: WorkoutTemplate): ProgramSession {
  const segments: SessionSegment[] = [
    segment(`${template.id}-warmup`, 'walk', 'warmup', template.warmupSeconds),
    ...mainSegments(template.id, template.shape),
    segment(`${template.id}-cooldown`, 'walk', 'cooldown', template.cooldownSeconds),
  ];
  const totalSeconds = segments.reduce((sum, item) => sum + item.seconds, 0);
  const runSeconds = segments
    .filter((item) => item.kind === 'run')
    .reduce((sum, item) => sum + item.seconds, 0);
  return {
    id: template.id,
    week: 1,
    day: 1,
    title: template.title,
    summary: workoutSummary(template.shape),
    segments,
    totalSeconds,
    runSeconds,
    // 일회성 훈련에는 "고비"가 없습니다. 오늘 하고 끝나는 것이니까요.
    isMilestone: false,
  };
}

/** 훈련이 사람이 할 수 있는 모양인지 봅니다. 빈 배열이면 통과입니다. */
export function validateWorkout(template: WorkoutTemplate): string[] {
  const problems: string[] = [];
  const session = buildWorkoutSession(template);

  for (const item of session.segments) {
    if (!Number.isFinite(item.seconds) || item.seconds <= 0) {
      problems.push(`${template.id}: ${item.id} 길이가 ${item.seconds}초입니다.`);
    }
  }
  const sum = session.segments.reduce((total, item) => total + item.seconds, 0);
  if (sum !== session.totalSeconds) {
    problems.push(`${template.id}: 구간 합과 전체가 다릅니다.`);
  }
  if (session.segments[0]?.role !== 'warmup') problems.push(`${template.id}: 준비 걷기가 없습니다.`);
  if (session.segments.at(-1)?.role !== 'cooldown') {
    problems.push(`${template.id}: 마무리 걷기가 없습니다.`);
  }
  if (session.totalSeconds > MAX_WORKOUT_SECONDS) {
    problems.push(
      `${template.id}: 전체가 ${Math.round(session.totalSeconds / 60)}분으로 너무 깁니다.`,
    );
  }
  // 걷기 훈련이 아닌데 뛰는 시간이 0이면 이름과 내용이 어긋납니다.
  if (template.shape.kind !== 'walk' && session.runSeconds <= 0) {
    problems.push(`${template.id}: 뛰는 시간이 없습니다.`);
  }
  return problems;
}

/** 짧은 훈련은 준비·마무리도 짧게 잡습니다. */
function leadIn(mainSeconds: number): { warmupSeconds: number; cooldownSeconds: number } {
  if (mainSeconds <= 20 * 60) {
    return { warmupSeconds: SHORT_WARMUP, cooldownSeconds: SHORT_COOLDOWN };
  }
  return { warmupSeconds: WARMUP, cooldownSeconds: COOLDOWN };
}

function steady(
  id: string,
  title: string,
  description: string,
  category: WorkoutCategory,
  minLevel: UserLevelId,
  minutes: number,
): WorkoutTemplate {
  const runSeconds = minutes * 60;
  return {
    id,
    title,
    subtitle: `${minutes}분 이어서`,
    description,
    category,
    minLevel,
    shape: { kind: 'steady', runSeconds },
    ...leadIn(runSeconds),
  };
}

function repeat(
  id: string,
  title: string,
  description: string,
  category: WorkoutCategory,
  minLevel: UserLevelId,
  runSeconds: number,
  walkSeconds: number,
  reps: number,
): WorkoutTemplate {
  const mainSeconds = runSeconds * reps + walkSeconds * Math.max(0, reps - 1);
  return {
    id,
    title,
    subtitle: `${formatDuration(runSeconds)} × ${reps}번`,
    description,
    category,
    minLevel,
    shape: { kind: 'repeat', runSeconds, walkSeconds, reps },
    ...leadIn(mainSeconds),
  };
}

function walkOnly(
  id: string,
  title: string,
  description: string,
  minLevel: UserLevelId,
  minutes: number,
): WorkoutTemplate {
  return {
    id,
    title,
    subtitle: `${minutes}분 걷기`,
    description,
    category: 'WALK',
    minLevel,
    shape: { kind: 'walk', walkSeconds: minutes * 60 },
    warmupSeconds: SHORT_WARMUP,
    cooldownSeconds: SHORT_COOLDOWN,
  };
}

function ladder(
  id: string,
  title: string,
  description: string,
  minLevel: UserLevelId,
  runSteps: number[],
  walkSeconds: number,
): WorkoutTemplate {
  const mainSeconds =
    runSteps.reduce((sum, value) => sum + value, 0) + walkSeconds * (runSteps.length - 1);
  return {
    id,
    title,
    subtitle: `${runSteps.length}단계`,
    description,
    category: 'LADDER',
    minLevel,
    shape: { kind: 'ladder', runSteps, walkSeconds },
    ...leadIn(mainSeconds),
  };
}

/**
 * 오늘 할 수 있는 훈련 목록입니다.
 *
 * 손으로 100줄을 적는 대신, 같은 갈래 안에서 길이만 바꾸는 것은 배열로 만듭니다.
 * 다만 "무엇을 위한 훈련인지"는 갈래마다 사람이 직접 썼습니다.
 * 설명이 없는 훈련은 사용자에게 아무 도움이 되지 않기 때문입니다.
 */
export const workoutTemplates: WorkoutTemplate[] = [
  // 편하게 이어 달리기 — 가장 많이 쓰게 되는 기본형입니다.
  ...[10, 12, 15, 18, 20, 22, 25, 30, 35, 40, 45, 50, 55, 60].map((minutes) =>
    steady(
      `easy-${minutes}m`,
      `편하게 ${minutes}분`,
      '옆 사람과 말할 수 있는 속도로 가요. 숨이 차면 늦춰도 괜찮아요.',
      'EASY',
      minutes <= 15 ? 'L2_RUN_10' : minutes <= 30 ? 'L3_RUN_30' : 'L4_5K',
      minutes,
    ),
  ),

  // 걷고 뛰기 — 아직 오래 못 뛰어도 오늘 나갈 수 있게 해 주는 형태입니다.
  ...[
    { run: 60, walk: 120, reps: 6 },
    { run: 60, walk: 120, reps: 8 },
    { run: 60, walk: 90, reps: 8 },
    { run: 90, walk: 90, reps: 6 },
    { run: 120, walk: 120, reps: 5 },
    { run: 120, walk: 90, reps: 6 },
    { run: 180, walk: 120, reps: 4 },
    { run: 180, walk: 90, reps: 5 },
    { run: 240, walk: 120, reps: 4 },
    { run: 300, walk: 120, reps: 3 },
    { run: 300, walk: 90, reps: 4 },
    { run: 420, walk: 120, reps: 3 },
    { run: 90, walk: 120, reps: 8 },
    { run: 150, walk: 120, reps: 4 },
    { run: 240, walk: 90, reps: 5 },
    { run: 360, walk: 120, reps: 3 },
  ].map((item) =>
    repeat(
      `walkrun-${item.run}-${item.walk}-${item.reps}`,
      `${formatDuration(item.run)} 뛰고 ${formatDuration(item.walk)} 걷기`,
      '뛰는 동안 힘들면 걷는 구간을 기다리면 돼요. 끝까지 가는 것이 목표예요.',
      'REPEAT',
      item.run <= 120 ? 'L0_MOVE' : item.run <= 240 ? 'L1_RUN_WALK' : 'L2_RUN_10',
      item.run,
      item.walk,
      item.reps,
    ),
  ),

  // 짧고 빠르게 — 다리 회전을 깨우는 훈련입니다. 숨보다 다리를 봅니다.
  ...[
    { run: 20, walk: 60, reps: 8 },
    { run: 20, walk: 40, reps: 10 },
    { run: 30, walk: 90, reps: 6 },
    { run: 30, walk: 60, reps: 8 },
    { run: 30, walk: 60, reps: 10 },
    { run: 45, walk: 90, reps: 6 },
    { run: 45, walk: 75, reps: 8 },
    { run: 60, walk: 120, reps: 5 },
    { run: 60, walk: 90, reps: 8 },
    { run: 60, walk: 60, reps: 10 },
  ].map((item) =>
    repeat(
      `stride-${item.run}-${item.reps}`,
      `${formatDuration(item.run)} 빠르게 ${item.reps}번`,
      '전력으로 하지 않아요. 편할 때보다 조금 빠른 정도, 자세가 무너지면 멈춰요.',
      'FAST',
      'L3_RUN_30',
      item.run,
      item.walk,
      item.reps,
    ),
  ),

  // 조금 빠르게 이어가기 — 숨은 차지만 유지할 수 있는 속도를 익힙니다.
  ...[8, 10, 12, 15, 20, 25].map((minutes) =>
    steady(
      `sustain-${minutes}m`,
      `조금 빠르게 ${minutes}분`,
      '말은 짧게만 되는 정도예요. 끝까지 같은 속도로 가는 것이 목표예요.',
      'FAST',
      minutes <= 12 ? 'L3_RUN_30' : 'L4_5K',
      minutes,
    ),
  ),

  // 오르막 — 언덕을 반복합니다. 속도 대신 밀어내는 힘을 씁니다.
  ...[
    { run: 30, walk: 90, reps: 6 },
    { run: 30, walk: 90, reps: 8 },
    { run: 30, walk: 90, reps: 10 },
    { run: 45, walk: 120, reps: 6 },
    { run: 45, walk: 120, reps: 8 },
    { run: 60, walk: 150, reps: 5 },
    { run: 60, walk: 150, reps: 6 },
    { run: 60, walk: 120, reps: 8 },
    { run: 90, walk: 180, reps: 5 },
    { run: 120, walk: 180, reps: 4 },
  ].map((item) =>
    repeat(
      `hill-${item.run}-${item.reps}`,
      `오르막 ${formatDuration(item.run)} ${item.reps}번`,
      '오르막을 뛰어 올라가고, 내려오면서 걸어요. 없으면 평지에서 조금 힘줘도 돼요.',
      'HILL',
      'L3_RUN_30',
      item.run,
      item.walk,
      item.reps,
    ),
  ),

  // 길게 — 시간을 늘리는 날입니다. 속도를 욕심내지 않습니다.
  ...[50, 60, 65, 70, 75, 80, 85].map((minutes) =>
    steady(
      `long-${minutes}m`,
      `길게 ${minutes}분`,
      '속도는 잊고 시간만 채워요. 오늘의 목표는 끝까지 가는 것 하나예요.',
      'LONG',
      minutes <= 60 ? 'L4_5K' : 'L5_10K',
      minutes,
    ),
  ),

  // 걷기 — 달리기가 아닌 날에도 앱을 켤 이유를 만듭니다.
  ...[10, 15, 20, 25, 30, 40, 45, 50, 60, 75].map((minutes) =>
    walkOnly(
      `walk-${minutes}m`,
      `${minutes}분 걷기`,
      '시선은 앞에 두고 편하게 걸어요. 이것도 오늘의 운동으로 기록돼요.',
      'L0_MOVE',
      minutes,
    ),
  ),

  // 러닝머신 — 밖에 못 나가는 날입니다. 거리 대신 시간만 봅니다.
  ...[15, 20, 25, 30, 40, 50].map((minutes) =>
    steady(
      `treadmill-${minutes}m`,
      `러닝머신 ${minutes}분`,
      '속도는 기계에 맡기고 시간만 채워요. 화면 대신 호흡을 봐요.',
      'TREADMILL',
      minutes <= 20 ? 'L2_RUN_10' : 'L3_RUN_30',
      minutes,
    ),
  ),
  ...[
    { run: 60, walk: 60, reps: 10 },
    { run: 120, walk: 60, reps: 8 },
    { run: 180, walk: 60, reps: 6 },
    { run: 240, walk: 60, reps: 5 },
  ].map((item) =>
    repeat(
      `treadmill-repeat-${item.run}-${item.reps}`,
      `러닝머신 ${formatDuration(item.run)} ${item.reps}번`,
      '속도를 두 단계만 오갑니다. 뛰는 구간에 한 칸 올리고 걷는 구간에 다시 내려요.',
      'TREADMILL',
      'L2_RUN_10',
      item.run,
      item.walk,
      item.reps,
    ),
  ),

  // 회복 — 어제 무리했거나 몸이 무거운 날입니다. 쌓지 않고 풀어 줍니다.
  ...[10, 15, 20, 25, 30].map((minutes) =>
    steady(
      `recovery-${minutes}m`,
      `회복 ${minutes}분`,
      '평소보다 확실히 느리게 가요. 오늘은 늘리는 날이 아니라 푸는 날이에요.',
      'RECOVERY',
      'L2_RUN_10',
      minutes,
    ),
  ),
  ...[
    { run: 120, walk: 180, reps: 4 },
    { run: 180, walk: 180, reps: 3 },
  ].map((item) =>
    repeat(
      `recovery-mix-${item.run}-${item.reps}`,
      `가볍게 ${formatDuration(item.run)} ${item.reps}번`,
      '뛰기와 걷기를 반씩 섞어요. 끝나고 더 할 수 있을 만큼만 해요.',
      'RECOVERY',
      'L1_RUN_WALK',
      item.run,
      item.walk,
      item.reps,
    ),
  ),

  // 짧게 — 시간이 없는 날에도 거르지 않게 합니다. 거르는 것보다 낫습니다.
  ...[8, 10, 12, 15, 18].map((minutes) =>
    steady(
      `short-${minutes}m`,
      `바쁜 날 ${minutes}분`,
      '시간이 없을 때는 이거면 충분해요. 안 나가는 것보다 훨씬 나아요.',
      'SHORT',
      'L2_RUN_10',
      minutes,
    ),
  ),
  ...[
    { run: 60, walk: 60, reps: 5 },
    { run: 90, walk: 60, reps: 5 },
  ].map((item) =>
    repeat(
      `short-repeat-${item.run}-${item.reps}`,
      `바쁜 날 ${formatDuration(item.run)} ${item.reps}번`,
      '짧아도 준비와 마무리는 지켜요. 그래야 다음 날이 편해요.',
      'SHORT',
      'L1_RUN_WALK',
      item.run,
      item.walk,
      item.reps,
    ),
  ),

  // 늘렸다 줄이기 — 같은 시간이라도 지루하지 않게 만드는 형태입니다.
  ladder(
    'ladder-1-2-3-2-1',
    '1분에서 3분까지 늘렸다 줄이기',
    '점점 길게 뛰다가 다시 짧아져요. 뒤로 갈수록 쉬워지니 끝까지 갈 수 있어요.',
    'L2_RUN_10',
    [60, 120, 180, 120, 60],
    90,
  ),
  ladder(
    'ladder-2-3-4-3-2',
    '2분에서 4분까지 늘렸다 줄이기',
    '가장 긴 구간이 가운데에 와요. 거기만 넘기면 나머지는 내리막이에요.',
    'L3_RUN_30',
    [120, 180, 240, 180, 120],
    90,
  ),
  ladder(
    'ladder-1-to-4',
    '1분에서 4분까지 한 계단씩',
    '한 계단씩 길어졌다가 다시 짧아져요. 오늘 어디까지 되는지 알기 좋아요.',
    'L3_RUN_30',
    [60, 120, 180, 240, 180, 120, 60],
    90,
  ),
  ladder(
    'ladder-30-60-90',
    '30초에서 1분 30초까지',
    '짧은 구간만 씁니다. 다리 회전을 깨우고 싶은 날에 좋아요.',
    'L2_RUN_10',
    [30, 60, 90, 60, 30],
    60,
  ),

  // 지금 내 상태 보기 — 기록을 재는 날입니다. 자주 하면 안 됩니다.
  {
    id: 'check-12m',
    title: '12분 최대로 가보기',
    subtitle: '12분',
    description:
      '12분 동안 갈 수 있는 만큼 갑니다. 한 달에 한 번이면 충분해요. 몸이 안 좋은 날에는 하지 마세요.',
    category: 'CHECK',
    minLevel: 'L4_5K',
    shape: { kind: 'steady', runSeconds: 12 * 60 },
    warmupSeconds: 600,
    cooldownSeconds: 600,
  },
  {
    id: 'check-20m',
    title: '20분 유지해 보기',
    subtitle: '20분',
    description:
      '20분 동안 유지할 수 있는 가장 빠른 속도를 찾아요. 앞이 빠르면 뒤가 무너지니 천천히 시작해요.',
    category: 'CHECK',
    minLevel: 'L5_10K',
    shape: { kind: 'steady', runSeconds: 20 * 60 },
    warmupSeconds: 600,
    cooldownSeconds: 600,
  },
];

/** 목록 전체가 안전한지 한 번에 봅니다. 빈 배열이면 통과입니다. */
export function validateWorkoutLibrary(): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const template of workoutTemplates) {
    if (seen.has(template.id)) problems.push(`훈련 ID가 겹칩니다: ${template.id}`);
    seen.add(template.id);
    problems.push(...validateWorkout(template));
  }
  return problems;
}

/** 지금 수준에서 할 수 있는 훈련만 남깁니다. */
export function availableWorkouts(level: UserLevelId): WorkoutTemplate[] {
  return workoutTemplates.filter(
    (template) => levelRank(level) >= levelRank(template.minLevel),
  );
}

/** 갈래별로 묶어 화면에 넘깁니다. 빈 갈래는 넘기지 않습니다. */
export function workoutsByCategory(
  level: UserLevelId,
): { category: WorkoutCategory; items: WorkoutTemplate[] }[] {
  const available = availableWorkouts(level);
  return (Object.keys(workoutCategoryLabels) as WorkoutCategory[])
    .map((category) => ({
      category,
      items: available.filter((template) => template.category === category),
    }))
    .filter((group) => group.items.length > 0);
}

/**
 * 오늘 하기 좋은 몇 개만 고릅니다.
 * 100개를 늘어놓으면 고르다가 지쳐서 안 나갑니다.
 */
export function suggestWorkouts(level: UserLevelId, limit = 4): WorkoutTemplate[] {
  const available = availableWorkouts(level);
  // 서로 다른 갈래에서 하나씩 뽑아 오늘의 선택지를 다양하게 만듭니다.
  const preferred: WorkoutCategory[] = ['EASY', 'REPEAT', 'SHORT', 'WALK', 'RECOVERY', 'FAST'];
  const picks: WorkoutTemplate[] = [];
  for (const category of preferred) {
    if (picks.length >= limit) break;
    const found = available.find((template) => template.category === category);
    if (found) picks.push(found);
  }
  return picks.slice(0, limit);
}
