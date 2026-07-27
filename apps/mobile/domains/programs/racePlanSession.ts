// 대회 훈련 계획의 한 회차를 "지금 바로 따라 할 수 있는 것"으로 바꿉니다.
//
// 왜 필요한가:
//   대회 계획은 지금까지 **보기 전용**이었습니다. "7km 편하게"라고 적혀 있어도
//   시작 버튼이 없어서, 사용자는 그 글을 읽고 알아서 나가야 했습니다.
//   계획이 실행 엔진에 닿지 않으면 그건 계획표 그림이지 훈련이 아닙니다.
//
// 어려운 점과 그 처리:
//   계획은 **거리(km)**로 쓰여 있고, 실행 엔진은 **시간(초)**으로 움직입니다.
//   그래서 사용자의 최근 기록에서 뽑은 속도로 거리를 시간으로 바꿉니다.
//   근거가 없으면 넉넉한 기본값을 쓰고, 화면에 "무엇을 근거로 잡았는지" 밝힙니다.
//   추정한 값을 사실인 것처럼 보여 주지 않습니다.
import type { PlanRun } from './racePlan';
import {
  formatDuration,
  type ProgramSession,
  type SegmentKind,
  type SessionSegment,
} from './types';

/** 준비·마무리 걷기입니다. 대회 계획 회차에도 똑같이 붙습니다. */
const WARMUP_SECONDS = 300;
const COOLDOWN_SECONDS = 300;

/**
 * 근거가 없을 때 쓰는 속도입니다(1km에 7분 30초).
 * 처음 달리는 사람에게 흔한 속도이고, 실제보다 느리게 잡히면 시간이 남을 뿐입니다.
 * 반대로 빠르게 잡으면 계획보다 짧게 끝나 훈련이 모자랍니다. 그래서 느린 쪽으로 둡니다.
 */
export const DEFAULT_PACE_SECONDS_PER_KM = 450;
/** 사람이 낼 수 있는 범위를 벗어난 값이 들어오면 여기로 자릅니다. */
export const MIN_PACE_SECONDS_PER_KM = 180;
export const MAX_PACE_SECONDS_PER_KM = 900;
/** 한 회차의 상한입니다. 이보다 길면 앱으로 따라 하기 어렵습니다. */
export const MAX_PLAN_SESSION_SECONDS = 100 * 60;

/** 최근 기록에서 뽑은 1km당 초입니다. 근거가 없으면 기본값을 씁니다. */
export function planPaceSecondsPerKm(
  totalKm: number,
  totalMinutes: number,
): { paceSecondsPerKm: number; fromRecords: boolean } {
  if (totalKm <= 0 || totalMinutes <= 0) {
    return { paceSecondsPerKm: DEFAULT_PACE_SECONDS_PER_KM, fromRecords: false };
  }
  const raw = (totalMinutes * 60) / totalKm;
  const clamped = Math.min(MAX_PACE_SECONDS_PER_KM, Math.max(MIN_PACE_SECONDS_PER_KM, raw));
  return { paceSecondsPerKm: Math.round(clamped), fromRecords: true };
}

function segment(
  id: string,
  kind: SegmentKind,
  role: SessionSegment['role'],
  seconds: number,
): SessionSegment {
  return { id, kind, role, seconds, label: kind === 'run' ? '뛰기' : '걷기' };
}

/** 5초 단위로 다듬습니다. 말하기 좋은 숫자입니다. */
function roundStep(seconds: number): number {
  return Math.max(5, Math.round(seconds / 5) * 5);
}

export type PlanSessionResult =
  | { ok: true; session: ProgramSession; paceNote: string }
  | { ok: false; reason: string };

/**
 * 계획의 한 회차를 실행 가능한 회차로 바꿉니다.
 *
 * 만들 수 없으면 이유를 돌려줍니다. 억지로 잘라서 만들지 않습니다.
 * 계획에 "20km 길게"라고 적혀 있는데 앱이 100분만 세고 끝내면, 사용자는
 * 계획을 지켰다고 착각하게 됩니다. 그건 기록을 거짓말로 만드는 일입니다.
 */
export function planRunToSession(
  run: PlanRun,
  paceSecondsPerKm: number,
  fromRecords: boolean,
): PlanSessionResult {
  if (run.kind === 'race') {
    return {
      ok: false,
      reason: '대회 당일은 앱이 시간을 세지 않아요. 대회 진행에 맞춰 달리면 돼요.',
    };
  }
  if (!Number.isFinite(run.km) || run.km <= 0) {
    return { ok: false, reason: '이 회차에는 거리가 없어요.' };
  }

  const pace = Math.min(
    MAX_PACE_SECONDS_PER_KM,
    Math.max(MIN_PACE_SECONDS_PER_KM, Math.round(paceSecondsPerKm)),
  );
  const runSeconds = roundStep(run.km * pace);
  const totalSeconds = WARMUP_SECONDS + runSeconds + COOLDOWN_SECONDS;

  if (totalSeconds > MAX_PLAN_SESSION_SECONDS) {
    return {
      ok: false,
      reason: `${run.km}km는 지금 속도로 ${formatDuration(
        runSeconds,
      )}쯤 걸려요. 앱으로 따라 하기에는 길어서, 이 회차는 직접 나가서 해요.`,
    };
  }

  const id = `raceplan-${run.id}`;
  const segments: SessionSegment[] = [
    segment(`${id}-warmup`, 'walk', 'warmup', WARMUP_SECONDS),
    segment(`${id}-run`, 'run', 'main', runSeconds),
    segment(`${id}-cooldown`, 'walk', 'cooldown', COOLDOWN_SECONDS),
  ];

  return {
    ok: true,
    session: {
      id,
      week: 1,
      day: 1,
      title: `${run.label} ${run.km}km`,
      summary: `${formatDuration(runSeconds)} 동안 이어서 달려요. ${run.note}`,
      segments,
      totalSeconds,
      runSeconds,
      isMilestone: false,
    },
    paceNote: fromRecords
      ? `최근 기록에서 잡은 속도(1km에 ${formatDuration(pace)}) 기준이에요.`
      : `아직 기록이 없어 넉넉한 속도(1km에 ${formatDuration(pace)})로 잡았어요.`,
  };
}
