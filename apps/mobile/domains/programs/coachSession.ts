// 프로그램 회차를 "메인 음성 코치가 그대로 읽을 수 있는 형태"로 바꿉니다.
//
// 왜 필요한가:
//   지금까지 9주 프로그램 회차는 화면에 글자로만 "곧 뛰기예요"를 보여 줬습니다.
//   말해 주는 코드가 아예 없어서, 휴대폰을 주머니에 넣으면 언제 걷고 언제 뛰는지 알 수 없었습니다.
//   자유 러닝은 startCoachSession(=네이티브 포그라운드 서비스)로 잘 말하고 있었으므로,
//   회차를 같은 계약(CoachSession)으로 바꾸기만 하면 같은 엔진이 그대로 읽어 줍니다.
//
// 여기서는 시간표만 만듭니다. 실제 말하기·화면 잠금 유지·일시정지는 기존 엔진이 합니다.
import type { CoachCue, CoachSession } from '../coaching/model';
import type { PhaseKind } from '../coaching/sessionTypes';
import { buildTimeline } from './session';
import { formatClock, type ProgramSession, type SessionSegment } from './types';

/** 구간이 바뀌기 몇 초 전에 미리 알려 줄지입니다. 숨이 찬 중에도 준비할 수 있는 간격입니다. */
export const PREVIEW_LEAD_SECONDS = 30;
/** 바로 직전 예고입니다. */
export const READY_LEAD_SECONDS = 10;
/** 구간이 이보다 짧으면 30초 예고를 넣지 않습니다(예고가 구간보다 길면 어색합니다). */
const MIN_SECONDS_FOR_PREVIEW = 45;
/** 구간이 이보다 길면 중간에 한 번 더 알려 줍니다. */
const MIN_SECONDS_FOR_HALFWAY = 90;

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

/**
 * 회차 하나를 음성 시간표로 바꿉니다.
 * 같은 회차를 넣으면 언제나 같은 결과가 나옵니다(결정적).
 */
export function programCoachCues(session: ProgramSession): CoachCue[] {
  const timeline = buildTimeline(session.segments);
  const cues: CoachCue[] = [];
  const push = (offsetSeconds: number, text: string, kind: CoachCue['kind']) => {
    // 시작 전이나 끝난 뒤로 새는 안내는 넣지 않습니다.
    if (offsetSeconds < 0 || offsetSeconds > timeline.totalSeconds) return;
    cues.push({ offsetSeconds: Math.round(offsetSeconds), text, kind });
  };

  push(0, `${session.title} 시작할게요. 전체 ${spokenDuration(timeline.totalSeconds)}이에요.`, 'phase');
  push(0, '주변을 확인하고, 불편하면 언제든 멈춰도 괜찮아요.', 'safety');

  timeline.entries.forEach((entry, index) => {
    const segment = entry.segment;
    const isFirst = index === 0;
    push(entry.startSeconds, startSentence(segment, isFirst), 'instruction');

    if (segment.seconds >= MIN_SECONDS_FOR_HALFWAY) {
      push(entry.startSeconds + segment.seconds / 2, halfwaySentence(segment), 'progress');
    }

    const next = timeline.entries[index + 1]?.segment;
    if (!next) return;
    if (segment.seconds >= MIN_SECONDS_FOR_PREVIEW) {
      push(entry.endSeconds - PREVIEW_LEAD_SECONDS, previewSentence(next), 'instruction');
    }
    push(entry.endSeconds - READY_LEAD_SECONDS, readySentence(next), 'instruction');
  });

  push(
    timeline.totalSeconds,
    `${session.title} 끝났어요. 전체 ${formatClock(timeline.totalSeconds)} 채웠어요. 수고했어요.`,
    'completion',
  );

  // 같은 시각에 여러 문장이 겹치면 듣기 나쁘므로 시간순으로만 정렬해 둡니다.
  // (한 번에 하나만 말하는 규칙은 발화 큐가 지킵니다.)
  return cues.sort((left, right) => left.offsetSeconds - right.offsetSeconds);
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
