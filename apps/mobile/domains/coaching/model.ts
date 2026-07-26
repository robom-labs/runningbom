// 유료 음성 없이 기기 TTS가 읽을 러닝 세션과 간격이 넓은 큐를 생성합니다.
import type { ActivityKind } from '../activities/types';

export const COACH_CONTENT_VERSION = '2026.07-v1';

export type GuidanceLevel = 'minimal' | 'standard' | 'detailed';
export type CoachSessionKind =
  | '편안한 지속주'
  | '걷고 달리기'
  | '회복하며'
  | '계속 달리기'
  | '조금 빠르게'
  | '인터벌'
  | '러닝머신'
  | '대회 전'
  | '회복 루틴'
  | '아침 깨우기'
  | '걷기';

export type CoachCue = {
  offsetSeconds: number;
  text: string;
  kind: 'safety' | 'instruction' | 'encouragement' | 'completion';
};

export type CoachSession = {
  id: string;
  title: CoachSessionKind;
  durationMinutes: number;
  guidance: GuidanceLevel;
  countsAs: ActivityKind;
  cues: CoachCue[];
};

export const recommendedSessionKinds: CoachSessionKind[] = [
  '편안한 지속주',
  '걷고 달리기',
  '회복하며',
  '계속 달리기',
];

const instructionPool: Record<CoachSessionKind, string[]> = {
  '편안한 지속주': ['말할 수 있는 편안한 힘으로 가요.', '어깨 힘을 가볍게 내려요.', '호흡을 억지로 맞추지 않아도 돼요.', '발걸음 소리를 가볍게 들어봐요.', '지금의 편안한 리듬을 이어가요.'],
  '걷고 달리기': ['지금은 가볍게 달려요.', '숨이 차면 편하게 걸어요.', '다시 움직일 준비가 되면 달려요.', '걷는 구간도 활동의 일부예요.', '내 리듬에 맞춰 전환해요.'],
  '회복하며': ['속도보다 몸의 느낌을 살펴요.', '발걸음을 작고 편하게 가져가요.', '무리하지 말고 여유를 남겨요.', '호흡이 편한 범위를 지켜요.', '오늘은 가볍게 마치는 게 좋아요.'],
  '계속 달리기': ['리듬을 유지하며 이어가요.', '상체를 편안하게 세워요.', '남은 시간도 같은 힘으로 가요.', '발걸음을 서두르지 않아도 돼요.', '호흡과 움직임을 편하게 맞춰요.'],
  '조금 빠르게': ['자세가 편한 선에서만 올려요.', '짧고 가벼운 발걸음을 유지해요.', '무리하면 바로 편한 속도로 돌아와요.', '속도보다 안정된 리듬이 먼저예요.', '남길 힘을 생각하며 이어가요.'],
  '인터벌': ['빠른 구간을 시작해요.', '이제 천천히 회복해요.', '다음 구간 전 호흡을 정리해요.', '빠른 구간도 힘을 남겨요.', '회복 구간은 충분히 천천히 가요.'],
  '러닝머신': ['벨트 중앙을 편안하게 유지해요.', '손잡이에 기대지 않고 가볍게 가요.', '속도 변경 전 주변을 확인해요.', '화면보다 발밑을 먼저 살펴요.', '정지 전 속도를 천천히 낮춰요.'],
  '대회 전': ['오늘은 여유를 남기는 러닝이에요.', '새 장비보다 익숙한 장비가 좋아요.', '가볍게 몸을 깨우고 마무리해요.', '속도 경쟁 없이 느낌만 확인해요.', '평소보다 짧게 마쳐도 괜찮아요.'],
  '회복 루틴': ['천천히 관절을 움직여요.', '통증이 느껴지면 바로 멈춰요.', '편안한 범위에서 호흡해요.', '반동 없이 부드럽게 움직여요.', '오늘의 몸 상태만 살펴봐요.'],
  '아침 깨우기': ['작은 움직임부터 시작해요.', '목과 어깨를 부드럽게 풀어요.', '오늘의 몸 상태를 천천히 확인해요.', '호흡을 길게 내쉬어 봐요.', '서두르지 않고 몸을 깨워요.'],
  '걷기': ['시선은 편안하게 앞을 봐요.', '팔을 자연스럽게 흔들어요.', '발걸음에 맞춰 편하게 호흡해요.', '걸음 폭을 무리하게 넓히지 않아요.', '주변을 보며 여유 있게 걸어요.'],
};

function intervalFor(guidance: GuidanceLevel): number {
  if (guidance === 'minimal') return 300;
  if (guidance === 'detailed') return 120;
  return 180;
}

function countsAsFor(title: CoachSessionKind): ActivityKind {
  if (title === '회복 루틴' || title === '아침 깨우기') return 'recovery';
  if (title === '걷기') return 'walk';
  return 'run';
}

export function createCoachSession(
  title: CoachSessionKind,
  durationMinutes: number,
  guidance: GuidanceLevel = 'standard',
): CoachSession {
  const safeDuration = Math.min(120, Math.max(5, Math.round(durationMinutes)));
  const durationSeconds = safeDuration * 60;
  const interval = intervalFor(guidance);
  const pool = instructionPool[title];
  const cues: CoachCue[] = [
    {
      offsetSeconds: 0,
      text: '주변을 확인하고 무리 없이 시작해요.',
      kind: 'safety',
    },
  ];

  let poolIndex = 0;
  for (let offset = Math.max(90, interval); offset < durationSeconds - 45; offset += interval) {
    cues.push({
      offsetSeconds: offset,
      text: pool[poolIndex % pool.length],
      kind: poolIndex % 3 === 2 ? 'encouragement' : 'instruction',
    });
    poolIndex += 1;
  }

  if (durationSeconds >= 600) {
    const midpoint = Math.floor(durationSeconds / 2);
    const nearestCue = cues
      .filter((cue) => cue.offsetSeconds > 0)
      .sort(
        (left, right) =>
          Math.abs(left.offsetSeconds - midpoint) - Math.abs(right.offsetSeconds - midpoint),
      )[0];
    if (nearestCue) {
      nearestCue.text = '불편하거나 아프면 속도를 낮추거나 멈춰요.';
      nearestCue.kind = 'safety';
    }
  }

  cues.push({
    offsetSeconds: Math.max(1, durationSeconds - 5),
    text: '오늘의 움직임을 마쳤어요. 천천히 정리해요.',
    kind: 'completion',
  });
  cues.sort((left, right) => left.offsetSeconds - right.offsetSeconds);

  return {
    id: `${title}:${safeDuration}:${guidance}:${COACH_CONTENT_VERSION}`,
    title,
    durationMinutes: safeDuration,
    guidance,
    countsAs: countsAsFor(title),
    cues,
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
