// 프로그램 회차를 "메인 음성 코치가 그대로 읽을 수 있는 형태"로 바꿉니다.
//
// 왜 필요한가:
//   지금까지 9주 프로그램 회차는 화면에 글자로만 "곧 뛰기예요"를 보여 줬습니다.
//   말해 주는 코드가 아예 없어서, 휴대폰을 주머니에 넣으면 언제 걷고 언제 뛰는지 알 수 없었습니다.
//   자유 러닝은 startCoachSession(=네이티브 포그라운드 서비스)로 잘 말하고 있었으므로,
//   회차를 같은 계약(CoachSession)으로 바꾸기만 하면 같은 엔진이 그대로 읽어 줍니다.
//
// 회장 보고 2차: "5분 동안 걷기 시작할게요 그건 말하는데 그 뒤에 말을 안 해."
//   실제로 두 가지가 겹쳐 있었습니다.
//   1) 0초에 대사를 세 개 겹쳐 놨습니다. 재생 엔진(네이티브·JS 모두)은 같은 시각에 밀린 대사 중
//      마지막 하나만 읽고 나머지를 버립니다. 그래서 세 마디 중 한 마디만 들렸습니다.
//   2) 그 다음 대사가 150초 뒤였습니다. 5분짜리 걷기 구간에 안내가 단 하나뿐이라,
//      귀로는 "고장 나서 말을 안 한다"와 구분되지 않습니다.
//   그래서 이 파일은 이제 (a) 대사를 절대 겹치지 않게 벌리고,
//   (b) 조용한 구간을 코칭 문장으로 채워 침묵이 MAX_SILENCE_SECONDS를 넘지 않게 합니다.
//
// 여기서는 시간표만 만듭니다. 실제 말하기·화면 잠금 유지·일시정지는 기존 엔진이 합니다.
import {
  categoryRotation,
  contextualCuePool,
  type CueCategory,
} from '../coaching/cueLibrary';
import type { CoachCue, CoachSession } from '../coaching/model';
import type { PhaseKind } from '../coaching/sessionTypes';
import { buildTimeline, type TimelineEntry } from './session';
import { formatClock, type ProgramSession, type SessionSegment } from './types';

/** 구간이 바뀌기 몇 초 전에 미리 알려 줄지입니다. 숨이 찬 중에도 준비할 수 있는 간격입니다. */
export const PREVIEW_LEAD_SECONDS = 30;
/** 바로 직전 예고입니다. */
export const READY_LEAD_SECONDS = 10;
/** 구간이 이보다 짧으면 30초 예고를 넣지 않습니다(예고가 구간보다 길면 어색합니다). */
const MIN_SECONDS_FOR_PREVIEW = 45;
/** 구간이 이보다 길면 중간에 한 번 더 알려 줍니다. */
const MIN_SECONDS_FOR_HALFWAY = 90;

/**
 * 대사 사이의 최소 간격입니다.
 * 재생 엔진은 같은 시각(정확히는 같은 500ms 틱)에 밀린 대사 중 하나만 읽고 나머지를 버립니다.
 * 그래서 시간표 단계에서 미리 벌려 둡니다. 이 값보다 촘촘하면 말이 사라집니다.
 */
export const MIN_CUE_GAP_SECONDS = 6;
/** 이보다 오래 조용하면 사용자는 고장으로 느낍니다. 넘지 않게 코칭 문장으로 채웁니다. */
export const MAX_SILENCE_SECONDS = 24;
/** 조용한 구간을 채울 때 쓰는 간격입니다. */
const FILL_INTERVAL_SECONDS = 18;
/** 여는 인사 뒤 첫 구간 안내를 넣는 시각입니다. */
const FIRST_SEGMENT_START_SECONDS = 6;
/** 안전 안내를 넣는 시각입니다. */
const SAFETY_SECONDS = 12;

/** 걷기·뛰기를 말로 할 때 쓰는 동사입니다. 화면 글자와 읽는 말을 분리합니다. */
function actionVerb(segment: SessionSegment): string {
  return segment.kind === 'run' ? '달리기' : '걷기';
}

/** 프로그램의 구간을 코치 엔진이 아는 단계 이름으로 옮깁니다. */
function phaseKindOf(segment: SessionSegment): PhaseKind {
  if (segment.role === 'warmup') return 'warmup';
  if (segment.role === 'cooldown') return 'cooldown';
  return segment.kind === 'run' ? 'work' : 'recovery';
}

/** "1분 30초" 처럼 귀로 듣기 좋은 길이 표현입니다. */
export function spokenDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  if (minutes === 0) return `${rest}초`;
  if (rest === 0) return `${minutes}분`;
  return `${minutes}분 ${rest}초`;
}

/** 준비·본운동·마무리 중 어디인지에 따라 시작 문장을 다르게 합니다. */
function startSentence(segment: SessionSegment, isFirst: boolean): string {
  const verb = actionVerb(segment);
  const length = spokenDuration(segment.seconds);
  if (isFirst) return `${length} 동안 ${verb}부터 시작할게요.`;
  if (segment.role === 'cooldown') return `마무리 ${verb}예요. ${length} 동안 천천히 걸어요.`;
  if (segment.kind === 'run') return `${verb} 시작해요. ${length}이에요. 빠를 필요 없어요.`;
  return `${verb} 시작해요. ${length} 동안 숨을 고를게요.`;
}

function previewSentence(next: SessionSegment): string {
  const verb = actionVerb(next);
  const length = spokenDuration(next.seconds);
  if (next.role === 'cooldown') return `${PREVIEW_LEAD_SECONDS}초 뒤에는 마무리 걷기예요.`;
  return `${PREVIEW_LEAD_SECONDS}초 뒤에는 ${length} 동안 ${verb}예요.`;
}

function readySentence(next: SessionSegment): string {
  return `${READY_LEAD_SECONDS}초 뒤 ${actionVerb(next)}예요.`;
}

function halfwaySentence(segment: SessionSegment): string {
  if (segment.kind === 'run') return '절반 지났어요. 어깨에 힘 빼고 그대로 가요.';
  return '절반 지났어요. 숨이 편해지면 그대로 걸어요.';
}

/** 카테고리를 화면·기록에서 쓰는 큐 종류로 옮깁니다. */
function kindForCategory(category: CueCategory): CoachCue['kind'] {
  if (category === 'safety') return 'safety';
  if (category === 'progress') return 'progress';
  if (category === 'encouragement' || category === 'mindset') return 'encouragement';
  return 'instruction';
}

/** 회차 ID만으로 정해지는 씨앗입니다. 같은 회차는 언제나 같은 문장을 얻습니다. */
function hashSeed(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

/** 최근에 쓴 문장을 피해 가며 뽑습니다. 30분 내내 같은 말을 반복하면 코치가 아닙니다. */
function createFillerPicker(seed: string): (pool: string[]) => string {
  let state = hashSeed(seed) || 1;
  const recent: string[] = [];
  return (pool) => {
    if (pool.length === 0) return '';
    const window = Math.min(pool.length - 1, 20);
    const blocked = new Set(recent.slice(-window));
    const candidates = pool.filter((line) => !blocked.has(line));
    const usable = candidates.length > 0 ? candidates : pool;
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    const chosen = usable[state % usable.length];
    recent.push(chosen);
    return chosen;
  };
}

/** 남은 시간은 초 단위로 읽어 주면 산만합니다. 10초 단위로 반올림합니다. */
function roundedRemaining(seconds: number): number {
  return Math.max(10, Math.round(seconds / 10) * 10);
}

type PriorityCue = CoachCue & {
  /** 클수록 먼저 자리를 잡습니다. 구간 경계 안내는 절대 밀리지 않습니다. */
  priority: number;
};

/**
 * 대사를 서로 MIN_CUE_GAP_SECONDS 이상 벌립니다.
 * 우선순위가 높은 대사가 먼저 자리를 잡고, 너무 가까운 낮은 우선순위 대사는 버립니다.
 * (버리는 쪽은 언제나 채움 문장이나 격려이고, "지금 뛰세요" 같은 안내는 남습니다.)
 */
function declutter(cues: PriorityCue[]): PriorityCue[] {
  const kept: PriorityCue[] = [];
  const ordered = [...cues].sort(
    (left, right) => right.priority - left.priority || left.offsetSeconds - right.offsetSeconds,
  );
  for (const cue of ordered) {
    const collides = kept.some(
      (other) => Math.abs(other.offsetSeconds - cue.offsetSeconds) < MIN_CUE_GAP_SECONDS,
    );
    if (collides) continue;
    kept.push(cue);
  }
  return kept.sort((left, right) => left.offsetSeconds - right.offsetSeconds);
}

/**
 * 회차 하나를 음성 시간표로 바꿉니다.
 * 같은 회차를 넣으면 언제나 같은 결과가 나옵니다(결정적).
 */
export function programCoachCues(session: ProgramSession): CoachCue[] {
  const timeline = buildTimeline(session.segments);
  const total = timeline.totalSeconds;
  const core: PriorityCue[] = [];
  const push = (
    offsetSeconds: number,
    text: string,
    kind: CoachCue['kind'],
    priority: number,
  ) => {
    // 시작 전이나 끝난 뒤로 새는 안내는 넣지 않습니다.
    if (!text) return;
    if (offsetSeconds < 0 || offsetSeconds > total) return;
    core.push({ offsetSeconds: Math.round(offsetSeconds), text, kind, priority });
  };

  push(0, `${session.title} 시작할게요. 전체 ${spokenDuration(total)}이에요.`, 'phase', 90);
  push(SAFETY_SECONDS, '주변을 확인하고, 불편하면 언제든 멈춰도 괜찮아요.', 'safety', 70);

  timeline.entries.forEach((entry, index) => {
    const segment = entry.segment;
    const isFirst = index === 0;
    // 첫 구간의 시작 안내만은 여는 인사와 겹치지 않게 몇 초 뒤로 둡니다.
    // 0초에 몰아 두면 엔진이 그중 하나만 읽고 나머지를 버립니다(이번 무음 신고의 원인).
    const startAt = isFirst
      ? Math.min(FIRST_SEGMENT_START_SECONDS, Math.max(0, segment.seconds - 2))
      : entry.startSeconds;
    push(startAt, startSentence(segment, isFirst), 'instruction', 100);

    if (segment.seconds >= MIN_SECONDS_FOR_HALFWAY) {
      push(entry.startSeconds + segment.seconds / 2, halfwaySentence(segment), 'progress', 60);
    }

    const next = timeline.entries[index + 1]?.segment;
    if (!next) return;
    if (segment.seconds >= MIN_SECONDS_FOR_PREVIEW) {
      push(entry.endSeconds - PREVIEW_LEAD_SECONDS, previewSentence(next), 'instruction', 95);
    }
    push(entry.endSeconds - READY_LEAD_SECONDS, readySentence(next), 'instruction', 100);
  });

  push(
    total,
    `${session.title} 끝났어요. 전체 ${formatClock(total)} 채웠어요. 수고했어요.`,
    'completion',
    100,
  );

  const anchored = declutter(core);
  const filled = declutter([...anchored, ...fillerCues(session, timeline, anchored)]);
  return filled.map(({ priority: _priority, ...cue }) => cue);
}

/**
 * 조용한 구간을 코칭 문장으로 채웁니다.
 * "지금 이 구간이 얼마나 남았는지"를 우선 알려 주고, 그사이에 자세·호흡·격려를 섞습니다.
 * 자유 러닝 코치가 쓰는 것과 같은 문장 풀을 그대로 씁니다(따로 관리하지 않습니다).
 */
function fillerCues(
  session: ProgramSession,
  timeline: ReturnType<typeof buildTimeline>,
  anchored: PriorityCue[],
): PriorityCue[] {
  const total = timeline.totalSeconds;
  if (total <= 0 || anchored.length === 0) return [];

  const pick = createFillerPicker(`${session.id}:${total}`);
  const rotation = categoryRotation.walkRun;
  const filler: PriorityCue[] = [];
  let step = 0;

  const entryAt = (offset: number): TimelineEntry =>
    timeline.entries.find(
      (entry) => offset >= entry.startSeconds && offset < entry.endSeconds,
    ) ?? timeline.entries[timeline.entries.length - 1];

  const gaps: { from: number; to: number }[] = [];
  for (let index = 1; index < anchored.length; index += 1) {
    gaps.push({ from: anchored[index - 1].offsetSeconds, to: anchored[index].offsetSeconds });
  }

  for (const gap of gaps) {
    if (gap.to - gap.from <= MAX_SILENCE_SECONDS) continue;
    for (
      let at = gap.from + FILL_INTERVAL_SECONDS;
      at <= gap.to - MIN_CUE_GAP_SECONDS;
      at += FILL_INTERVAL_SECONDS
    ) {
      const entry = entryAt(at);
      const segment = entry.segment;
      const remaining = entry.endSeconds - at;
      step += 1;

      // 두 번에 한 번은 "이 구간 얼마 남았는지"를 알려 줍니다. 가장 듣고 싶어 하는 정보입니다.
      if (step % 2 === 1 && remaining >= 35 && segment.seconds >= 90) {
        filler.push({
          offsetSeconds: at,
          text: `${actionVerb(segment)} ${spokenDuration(roundedRemaining(remaining))} 남았어요.`,
          kind: 'progress',
          priority: 30,
        });
        continue;
      }

      const category = rotation[step % rotation.length];
      const pool = contextualCuePool('walkRun', category, {
        ratio: at / total,
        allowEasyIntensity: true,
        // 걷는 중에 "속도를 올려요"라고 말하면 안 됩니다.
        allowSpeedUp: segment.kind === 'run',
        isWarmup: segment.role === 'warmup',
      });
      const text = pick(pool);
      if (!text) continue;
      filler.push({
        offsetSeconds: at,
        text,
        kind: kindForCategory(category),
        priority: 20,
      });
    }
  }

  return filler;
}

/**
 * 프로그램 회차를 메인 코치 엔진이 받는 형태로 감쌉니다.
 * typeId는 목소리 톤을 고르는 데만 쓰이며, 걷기·뛰기를 오가는 회차라 walkRun으로 둡니다.
 */
export function programCoachSession(session: ProgramSession): CoachSession {
  const timeline = buildTimeline(session.segments);
  return {
    id: session.id,
    title: '걷고 달리기',
    typeId: 'walkRun',
    durationMinutes: Math.max(1, Math.round(timeline.totalSeconds / 60)),
    guidance: 'standard',
    countsAs: session.runSeconds > 0 ? 'run' : 'walk',
    summary: session.title,
    phases: timeline.entries.map((entry, index) => ({
      index,
      kind: phaseKindOf(entry.segment),
      label: entry.segment.label,
      startSeconds: entry.startSeconds,
      endSeconds: entry.endSeconds,
    })),
    cues: programCoachCues(session),
  };
}
