// 러닝 방식별 전환 멘트와 기기 TTS 큐를 만드는 코칭 도메인 정본입니다.
import type { ActivityKind } from '../activities/types';

export const COACH_CONTENT_VERSION = '2026.07-v2';

export type GuidanceLevel = 'minimal' | 'standard' | 'detailed';
export type CoachSessionKind =
  | '기본 지속주'
  | '인터벌'
  | '템포런'
  | '롱런'
  | '회복 걷기'
  | '편안한 지속주'
  | '걷고 달리기'
  | '회복하며'
  | '계속 달리기'
  | '조금 빠르게'
  | '러닝머신'
  | '대회 전'
  | '회복 루틴'
  | '아침 깨우기'
  | '걷기';

export type CoachCue = {
  offsetSeconds: number;
  text: string;
  kind: 'safety' | 'instruction' | 'phase' | 'encouragement' | 'completion';
};

export type CoachSession = {
  id: string;
  title: CoachSessionKind;
  durationMinutes: number;
  guidance: GuidanceLevel;
  countsAs: ActivityKind;
  summary: string;
  cues: CoachCue[];
};

export const recommendedSessionKinds: CoachSessionKind[] = [
  '기본 지속주',
  '인터벌',
  '템포런',
  '롱런',
  '회복 걷기',
];

export const sessionSummaries: Record<CoachSessionKind, string> = {
  '기본 지속주': '말은 할 수 있는 편안한 속도로 리듬을 쌓아요.',
  인터벌: '빠르게 달리는 구간과 회복 구간을 번갈아 진행해요.',
  템포런: '조금 숨차지만 유지 가능한 집중 구간을 경험해요.',
  롱런: '속도를 욕심내지 않고 긴 시간을 안정적으로 가요.',
  '회복 걷기': '가볍게 걸으며 다리의 긴장을 풀어 줘요.',
  '편안한 지속주': '기본 지속주로 이어집니다.',
  '걷고 달리기': '인터벌의 부드러운 입문 버전입니다.',
  '회복하며': '회복 걷기로 이어집니다.',
  '계속 달리기': '기본 지속주로 이어집니다.',
  '조금 빠르게': '템포런으로 이어집니다.',
  러닝머신: '러닝머신에서 속도를 안전하게 조절해요.',
  '대회 전': '피로를 남기지 않는 짧은 준비 러닝이에요.',
  '회복 루틴': '관절과 호흡을 부드럽게 정리해요.',
  '아침 깨우기': '작은 움직임으로 몸을 천천히 깨워요.',
  걷기: '시선과 호흡을 편안하게 두고 걸어요.',
};

const cuePools: Record<CoachSessionKind, string[]> = {
  '기본 지속주': [
    '시선은 멀리 두고, 어깨 힘은 살짝 내려요.',
    '발이 몸보다 너무 앞에 닿지 않게 가볍게 디뎌요.',
    '팔은 앞뒤로 편하게 흔들고 손은 가볍게 쥐어요.',
    '호흡이 거칠어지면 속도를 조금 낮춰도 충분해요.',
    '골반을 세우고 상체는 길게 유지해 볼게요.',
  ],
  인터벌: [
    '빠른 구간도 어깨를 올리지 말고 팔 리듬으로 이끌어요.',
    '회복 구간에서는 숨을 고르고 보폭을 편하게 줄여요.',
    '다음 빠른 구간을 위해 힘을 모두 쓰지 않고 남겨요.',
    '발걸음은 짧고 가볍게, 상체는 앞으로 무너지지 않게 해요.',
  ],
  템포런: [
    '조금 힘들어도 턱과 어깨에 힘이 들어가지 않게 해요.',
    '발걸음을 세게 밀기보다 리듬을 일정하게 유지해요.',
    '호흡이 무너지면 오늘은 편안한 속도로 돌아와도 괜찮아요.',
    '팔꿈치를 뒤로 보내며 상체의 균형을 잡아 볼게요.',
  ],
  롱런: [
    '긴 러닝일수록 처음 속도를 아껴 두는 것이 좋아요.',
    '어깨와 손에 힘이 들어갔는지 가볍게 확인해요.',
    '보폭을 무리하게 늘리지 말고 일정한 리듬을 지켜요.',
    '물과 주변 상황을 확인하며 편안하게 이어가요.',
  ],
  '회복 걷기': [
    '시선은 편안히 앞을 보고 팔을 자연스럽게 흔들어요.',
    '발뒤꿈치부터 부드럽게 닿고 발끝으로 가볍게 밀어요.',
    '숨을 길게 내쉬며 몸의 긴장을 조금 내려놔요.',
  ],
  '편안한 지속주': ['말할 수 있는 힘으로 가요.', '어깨 힘을 내려요.', '발걸음을 가볍게 이어가요.'],
  '걷고 달리기': ['지금은 편하게 달려요.', '회복하며 걸어요.', '다시 움직일 준비를 해요.'],
  '회복하며': ['속도보다 몸의 느낌을 살펴요.', '무리하지 말고 여유를 남겨요.'],
  '계속 달리기': ['리듬을 유지해요.', '호흡과 움직임을 편하게 맞춰요.'],
  '조금 빠르게': ['자세가 편한 선에서만 올려요.', '짧고 가벼운 발걸음을 유지해요.'],
  러닝머신: ['벨트 중앙을 편안하게 유지해요.', '속도 변경 전 주변을 확인해요.'],
  '대회 전': ['오늘은 여유를 남기는 러닝이에요.', '익숙한 장비로 가볍게 마쳐요.'],
  '회복 루틴': ['통증이 느껴지면 바로 멈춰요.', '반동 없이 부드럽게 움직여요.'],
  '아침 깨우기': ['작은 움직임부터 시작해요.', '목과 어깨를 부드럽게 풀어요.'],
  걷기: ['시선은 편안하게 앞을 봐요.', '팔을 자연스럽게 흔들어요.'],
};

function countsAsFor(title: CoachSessionKind): ActivityKind {
  if (title === '회복 루틴' || title === '아침 깨우기') return 'recovery';
  if (title === '회복 걷기' || title === '걷기') return 'walk';
  return 'run';
}

function detailInterval(guidance: GuidanceLevel): number {
  if (guidance === 'minimal') return 300;
  if (guidance === 'detailed') return 110;
  return 160;
}

function addIntervalPhases(cues: CoachCue[], durationSeconds: number) {
  const work = 300;
  const recovery = 60;
  let startsWithWork = true;
  for (let offset = 0; offset < durationSeconds - 30; offset += startsWithWork ? work : recovery) {
    const isWork = startsWithWork;
    if (offset > 0) {
      cues.push({
        offsetSeconds: offset,
        text: isWork ? '빠른 구간을 시작해요. 팔 리듬을 유지해 볼게요.' : '이제 회복하며 걸어요. 호흡을 고르세요.',
        kind: 'phase',
      });
    }
    const next = offset + (isWork ? work : recovery);
    if (isWork && next + 10 < durationSeconds) {
      cues.push({
        offsetSeconds: next - 10,
        text: '10초 뒤 회복 구간이에요. 속도를 부드럽게 낮출 준비를 해요.',
        kind: 'phase',
      });
    }
    if (!isWork && next + 10 < durationSeconds) {
      cues.push({
        offsetSeconds: next - 10,
        text: '10초 뒤 다시 달려요. 상체를 세우고 가볍게 출발해요.',
        kind: 'phase',
      });
    }
    startsWithWork = !startsWithWork;
  }
}

export function createCoachSession(
  title: CoachSessionKind,
  durationMinutes: number,
  guidance: GuidanceLevel = 'standard',
): CoachSession {
  const safeDuration = Math.min(120, Math.max(10, Math.round(durationMinutes)));
  const durationSeconds = safeDuration * 60;
  const cues: CoachCue[] = [{
    offsetSeconds: 0,
    text: '주변을 확인하고 시작해요. 불편하거나 아프면 바로 속도를 낮추거나 멈춰요.',
    kind: 'safety',
  }];
  const pool = cuePools[title];

  if (title === '인터벌' || title === '걷고 달리기') addIntervalPhases(cues, durationSeconds);

  let poolIndex = 0;
  const interval = detailInterval(guidance);
  for (let offset = Math.max(95, interval); offset < durationSeconds - 45; offset += interval) {
    if (cues.some((cue) => Math.abs(cue.offsetSeconds - offset) < 25)) continue;
    cues.push({
      offsetSeconds: offset,
      text: pool[poolIndex % pool.length],
      kind: poolIndex % 3 === 2 ? 'encouragement' : 'instruction',
    });
    poolIndex += 1;
  }

  if (durationSeconds >= 600) {
    cues.push({
      offsetSeconds: Math.floor(durationSeconds / 2),
      text: '지금까지 잘 이어왔어요. 몸이 불편하면 속도를 낮추고, 괜찮다면 같은 리듬을 유지해요.',
      kind: 'safety',
    });
  }
  cues.push({
    offsetSeconds: Math.max(1, durationSeconds - 5),
    text: '오늘의 움직임을 마쳤어요. 바로 멈추지 말고 천천히 걸으며 호흡을 정리해요.',
    kind: 'completion',
  });
  const deduped = cues
    .sort((left, right) => left.offsetSeconds - right.offsetSeconds)
    .filter((cue, index, values) => index === 0 || cue.offsetSeconds !== values[index - 1].offsetSeconds);

  return {
    id: `${title}:${safeDuration}:${guidance}:${COACH_CONTENT_VERSION}`,
    title,
    durationMinutes: safeDuration,
    guidance,
    countsAs: countsAsFor(title),
    summary: sessionSummaries[title],
    cues: deduped,
  };
}

export function cueScheduleForNative(session: CoachSession): string {
  return session.cues
    .map((cue) => `${cue.offsetSeconds}|${cue.text.replaceAll('|', ' ').replaceAll('\n', ' ')}`)
    .join('\n');
}

export function cueSilenceRatio(session: CoachSession): number {
  const estimatedSpokenSeconds = session.cues.reduce(
    (total, cue) => total + Math.max(2, cue.text.length / 4.5),
    0,
  );
  return Math.max(0, 1 - estimatedSpokenSeconds / (session.durationMinutes * 60));
}
