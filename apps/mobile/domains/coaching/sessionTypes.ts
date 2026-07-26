// 러닝 유형의 기준(목적·강도·추천·구성)과 구간 타임라인을 정의하는 정본입니다.
import type { ActivityKind } from '../activities/types';

/** 저장된 기록과 네이티브 세션 제목으로 계속 쓰이는 사용자 표시 이름입니다. */
export type CoachSessionKind =
  // 기존(하위호환) 이름
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
  | '걷기'
  // 표준 러닝 유형으로 새로 추가된 이름
  | '이지런'
  | '파틀렉'
  | '빌드업'
  | '힐 리핏'
  | '스트라이드'
  | '리커버리 워크'
  | '워크런'
  | '대회 전 세이버';

export type RunningTypeId =
  | 'easy'
  | 'long'
  | 'tempo'
  | 'interval'
  | 'fartlek'
  | 'progression'
  | 'hill'
  | 'strides'
  | 'recoveryWalk'
  | 'walkRun'
  | 'treadmill'
  | 'taper'
  | 'mobility'
  | 'wakeup'
  | 'walk';

export type RunningTypeCategory = '회복' | '기본' | '스피드' | '장거리' | '특수';

export const runningTypeCategories: RunningTypeCategory[] = [
  '회복',
  '기본',
  '스피드',
  '장거리',
  '특수',
];

export type PhaseKind =
  | 'warmup'
  | 'steady'
  | 'work'
  | 'recovery'
  | 'surge'
  | 'climb'
  | 'descent'
  | 'stride'
  | 'walk'
  | 'build'
  | 'cooldown'
  | 'mobility';

/** 러닝 중 화면에서 크게 보여 주는 구간 묶음 이름입니다. */
export type PhaseGroup = '워밍업' | '본운동' | '회복' | '쿨다운';

export const phaseGroups: Record<PhaseKind, PhaseGroup> = {
  warmup: '워밍업',
  steady: '본운동',
  work: '본운동',
  surge: '본운동',
  climb: '본운동',
  build: '본운동',
  stride: '본운동',
  mobility: '본운동',
  recovery: '회복',
  descent: '회복',
  walk: '회복',
  cooldown: '쿨다운',
};

export type SessionPhase = {
  index: number;
  kind: PhaseKind;
  label: string;
  startSeconds: number;
  endSeconds: number;
  repIndex?: number;
  totalReps?: number;
};

export type RunningTypeDefinition = {
  id: RunningTypeId;
  title: CoachSessionKind;
  aliases: CoachSessionKind[];
  category: RunningTypeCategory;
  countsAs: ActivityKind;
  /** 이 러닝을 왜 하는지에 대한 한 줄 목적입니다. */
  purpose: string;
  /** 말하기로 가늠하는 체감 강도입니다. */
  intensityLabel: string;
  /** 자각강도(RPE) 1~10 범위입니다. */
  rpe: { min: number; max: number };
  bestFor: string[];
  avoidIf: string[];
  defaultMinutes: number;
  minMinutes: number;
  maxMinutes: number;
  /** 워밍업·본운동·쿨다운 구성 요약입니다. */
  structure: string[];
  summary: string;
};

export const runningTypes: RunningTypeDefinition[] = [
  {
    id: 'easy',
    title: '이지런',
    aliases: ['기본 지속주', '편안한 지속주', '계속 달리기'],
    category: '기본',
    countsAs: 'run',
    purpose: '가장 기본이 되는 편안한 지속주로 러닝 습관과 리듬을 쌓아요.',
    intensityLabel: '옆사람과 계속 대화할 수 있는 강도',
    rpe: { min: 3, max: 4 },
    bestFor: ['주 3회 이상 꾸준히 달리고 싶은 분', '오랜만에 다시 달리기를 시작하는 분'],
    avoidIf: ['숨이 금방 차서 대화가 끊기는 날', '컨디션이 평소보다 많이 떨어진 날'],
    defaultMinutes: 30,
    minMinutes: 10,
    maxMinutes: 90,
    structure: ['워밍업: 걷기와 아주 가벼운 조깅', '본운동: 대화 가능한 속도로 지속주', '쿨다운: 속도를 줄이며 호흡 정리'],
    summary: '말은 할 수 있는 편안한 속도로 리듬을 쌓아요.',
  },
  {
    id: 'long',
    title: '롱런',
    aliases: [],
    category: '장거리',
    countsAs: 'run',
    purpose: '평소보다 긴 시간을 이지런 강도로 이어가며 지구력의 바탕을 만들어요.',
    intensityLabel: '이지런과 같거나 살짝 편한 강도',
    rpe: { min: 3, max: 5 },
    bestFor: ['10km 이상이나 하프를 준비하는 분', '주 1회 긴 러닝을 넣고 싶은 분'],
    avoidIf: ['이번 주 피로가 많이 쌓인 날', '수분을 챙길 방법이 없는 코스'],
    defaultMinutes: 70,
    minMinutes: 40,
    maxMinutes: 120,
    structure: ['워밍업: 걷기와 조깅으로 천천히 시작', '본운동: 초반·중반·후반 3구간을 같은 리듬으로', '쿨다운: 걷기와 호흡 정리'],
    summary: '속도를 욕심내지 않고 긴 시간을 안정적으로 가요.',
  },
  {
    id: 'tempo',
    title: '템포런',
    aliases: ['조금 빠르게'],
    category: '스피드',
    countsAs: 'run',
    purpose: '숨차지만 유지할 수 있는 역치 근처 속도를 일정하게 이어가는 연습이에요.',
    intensityLabel: '한두 마디만 겨우 나오는 강도',
    rpe: { min: 6, max: 7 },
    bestFor: ['이지런이 편해져서 다음 단계가 필요한 분', '대회 목표 페이스를 익히고 싶은 분'],
    avoidIf: ['달리기를 시작한 지 얼마 되지 않은 시기', '이틀 연속으로 강한 러닝을 한 뒤'],
    defaultMinutes: 40,
    minMinutes: 20,
    maxMinutes: 80,
    structure: ['워밍업: 충분한 이지 조깅', '본운동: 템포 구간 유지(길면 두 블록으로 분할)', '쿨다운: 아주 느린 조깅과 걷기'],
    summary: '조금 숨차지만 유지 가능한 집중 구간을 경험해요.',
  },
  {
    id: 'interval',
    title: '인터벌',
    aliases: [],
    category: '스피드',
    countsAs: 'run',
    purpose: '빠른 구간과 회복 구간을 번갈아 반복하며 속도 감각을 익혀요.',
    intensityLabel: '빠른 구간에서는 거의 말하기 어려운 강도',
    rpe: { min: 8, max: 9 },
    bestFor: ['기본 지속주가 익숙해진 분', '속도 변화를 연습하고 싶은 분'],
    avoidIf: ['달리기 경험이 아직 적은 시기', '몸이 무겁거나 잠이 부족한 날'],
    defaultMinutes: 35,
    minMinutes: 20,
    maxMinutes: 70,
    structure: ['워밍업: 이지 조깅으로 충분히', '본운동: 빠른 1분 + 회복 1분 30초 반복', '쿨다운: 걷기까지 천천히 낮추기'],
    summary: '빠르게 달리는 구간과 회복 구간을 번갈아 진행해요.',
  },
  {
    id: 'fartlek',
    title: '파틀렉',
    aliases: [],
    category: '스피드',
    countsAs: 'run',
    purpose: '정해진 트랙 없이 자유롭게 빠르기를 바꾸며 달리는 놀이 같은 스피드 러닝이에요.',
    intensityLabel: '구간마다 편안함과 숨참을 오가는 강도',
    rpe: { min: 4, max: 8 },
    bestFor: ['인터벌이 부담스러운 분', '지루하지 않게 변화를 주고 싶은 분'],
    avoidIf: ['사람이나 차가 많아 속도 변화가 위험한 코스'],
    defaultMinutes: 35,
    minMinutes: 20,
    maxMinutes: 70,
    structure: ['워밍업: 이지 조깅', '본운동: 짧은 서지와 편한 구간을 번갈아', '쿨다운: 천천히 속도 낮추기'],
    summary: '자유롭게 빠르기를 바꾸며 달리는 변화 있는 러닝이에요.',
  },
  {
    id: 'progression',
    title: '빌드업',
    aliases: [],
    category: '스피드',
    countsAs: 'run',
    purpose: '처음은 아주 편하게, 뒤로 갈수록 조금씩 속도를 올리는 프로그레션 러닝이에요.',
    intensityLabel: '편안함에서 시작해 마지막에 숨찬 정도까지',
    rpe: { min: 4, max: 7 },
    bestFor: ['초반 오버페이스가 잦은 분', '후반에 힘을 남기는 감각을 익히고 싶은 분'],
    avoidIf: ['이미 다리가 무거운 날'],
    defaultMinutes: 40,
    minMinutes: 20,
    maxMinutes: 90,
    structure: ['워밍업: 걷기와 조깅', '본운동: 1단계·2단계·3단계로 단계별 상승', '쿨다운: 다시 아주 편한 속도로'],
    summary: '뒤로 갈수록 조금씩 속도를 올리며 마무리해요.',
  },
  {
    id: 'hill',
    title: '힐 리핏',
    aliases: [],
    category: '스피드',
    countsAs: 'run',
    purpose: '짧은 언덕을 반복해 오르며 힘 있게 미는 감각과 자세를 연습해요.',
    intensityLabel: '오르막에서는 말하기 어려운 강도',
    rpe: { min: 7, max: 9 },
    bestFor: ['평지 러닝이 익숙해진 분', '언덕이 있는 코스를 준비하는 분'],
    avoidIf: ['무릎이나 발목이 불편한 날', '노면이 미끄러운 날'],
    defaultMinutes: 35,
    minMinutes: 20,
    maxMinutes: 60,
    structure: ['워밍업: 평지에서 넉넉하게 조깅', '본운동: 오르막 45초 + 내리막 회복 반복', '쿨다운: 평지에서 아주 느리게'],
    summary: '짧은 언덕을 반복하며 밀어내는 힘을 익혀요.',
  },
  {
    id: 'strides',
    title: '스트라이드',
    aliases: [],
    category: '스피드',
    countsAs: 'run',
    purpose: '20초 안팎의 짧고 빠른 질주를 넉넉한 회복과 함께 반복하는 윈드스프린트예요.',
    intensityLabel: '짧게 빠르지만 끝까지 여유가 남는 강도',
    rpe: { min: 7, max: 8 },
    bestFor: ['이지런 뒤에 감각을 깨우고 싶은 분', '대회 전 다리를 가볍게 만들고 싶은 분'],
    avoidIf: ['워밍업이 충분하지 않은 상태', '노면이 고르지 않은 코스'],
    defaultMinutes: 30,
    minMinutes: 15,
    maxMinutes: 60,
    structure: ['워밍업: 이지 조깅을 길게', '본운동: 20초 스트라이드 + 100초 회복 반복', '쿨다운: 걷기까지 천천히'],
    summary: '짧고 빠른 질주와 충분한 회복을 반복해요.',
  },
  {
    id: 'recoveryWalk',
    title: '리커버리 워크',
    aliases: ['회복 걷기', '회복하며'],
    category: '회복',
    countsAs: 'walk',
    purpose: '달리기 다음 날이나 쉬어가는 날, 가볍게 걸으며 몸을 풀어 주는 시간이에요.',
    intensityLabel: '대화가 전혀 힘들지 않은 강도',
    rpe: { min: 1, max: 2 },
    bestFor: ['강한 러닝 다음 날', '연속 기록을 이어가고 싶은 날'],
    avoidIf: ['걷기도 불편할 만큼 통증이 느껴지는 날'],
    defaultMinutes: 25,
    minMinutes: 10,
    maxMinutes: 90,
    structure: ['처음: 아주 천천히 시작', '중간: 편안한 걸음 유지', '마무리: 호흡을 길게 정리'],
    summary: '가볍게 걸으며 다리의 긴장을 풀어 줘요.',
  },
  {
    id: 'walkRun',
    title: '워크런',
    aliases: ['걷고 달리기'],
    category: '기본',
    countsAs: 'run',
    purpose: '달리기와 걷기를 번갈아 하며 처음 30분 완주까지 안전하게 이어가는 방식이에요.',
    intensityLabel: '달리는 구간에서도 대화가 가능한 강도',
    rpe: { min: 3, max: 5 },
    bestFor: ['달리기를 처음 시작하는 분', '한 번에 오래 달리기 부담스러운 분'],
    avoidIf: ['이미 30분 연속 달리기가 편해진 경우에는 이지런이 더 맞아요'],
    defaultMinutes: 30,
    minMinutes: 10,
    maxMinutes: 80,
    structure: ['워밍업: 걷기', '본운동: 달리기 1분 + 걷기 1분 30초 반복', '쿨다운: 걷기와 호흡 정리'],
    summary: '달리기와 걷기를 번갈아 하며 부담 없이 이어가요.',
  },
  {
    id: 'treadmill',
    title: '러닝머신',
    aliases: [],
    category: '특수',
    countsAs: 'run',
    purpose: '실내에서 속도와 경사를 직접 조절하며 일정한 리듬으로 달려요.',
    intensityLabel: '이지런에서 템포 사이로 직접 고르는 강도',
    rpe: { min: 4, max: 6 },
    bestFor: ['날씨나 시간 때문에 실내가 편한 분', '일정한 속도를 유지하고 싶은 분'],
    avoidIf: ['기기 조작이 익숙하지 않아 불안한 상태'],
    defaultMinutes: 35,
    minMinutes: 10,
    maxMinutes: 90,
    structure: ['워밍업: 걷기에서 조깅으로 단계 상승', '본운동: 목표 속도 유지', '쿨다운: 속도를 단계적으로 낮추기'],
    summary: '러닝머신에서 속도를 안전하게 조절해요.',
  },
  {
    id: 'taper',
    title: '대회 전 세이버',
    aliases: ['대회 전'],
    category: '특수',
    countsAs: 'run',
    purpose: '대회를 앞두고 피로를 남기지 않으면서 감각만 살려 두는 짧은 테이퍼 러닝이에요.',
    intensityLabel: '끝나고도 더 달릴 수 있을 만큼 여유 있는 강도',
    rpe: { min: 3, max: 4 },
    bestFor: ['대회를 1~3일 앞둔 분', '큰 러닝 뒤 감각만 유지하고 싶은 분'],
    avoidIf: ['새로운 장비나 새로운 코스를 시험하고 싶은 날'],
    defaultMinutes: 25,
    minMinutes: 10,
    maxMinutes: 50,
    structure: ['워밍업: 아주 편한 조깅', '본운동: 짧은 이지런', '마무리: 20초 스트라이드 몇 번과 걷기'],
    summary: '피로를 남기지 않는 짧은 준비 러닝이에요.',
  },
  {
    id: 'mobility',
    title: '회복 루틴',
    aliases: [],
    category: '회복',
    countsAs: 'recovery',
    purpose: '관절과 호흡을 부드럽게 정리하는 저강도 회복 시간이에요.',
    intensityLabel: '숨이 거의 차지 않는 강도',
    rpe: { min: 1, max: 2 },
    bestFor: ['러닝을 쉬어가는 날', '몸이 뻣뻣하게 느껴지는 날'],
    avoidIf: ['통증이 느껴지는 동작'],
    defaultMinutes: 15,
    minMinutes: 10,
    maxMinutes: 45,
    structure: ['처음: 호흡부터 천천히', '중간: 반동 없이 부드러운 움직임', '마무리: 길게 내쉬며 정리'],
    summary: '관절과 호흡을 부드럽게 정리해요.',
  },
  {
    id: 'wakeup',
    title: '아침 깨우기',
    aliases: [],
    category: '회복',
    countsAs: 'recovery',
    purpose: '작은 움직임으로 몸을 천천히 깨우는 아침용 저강도 루틴이에요.',
    intensityLabel: '잠에서 깨는 정도의 아주 가벼운 강도',
    rpe: { min: 2, max: 3 },
    bestFor: ['아침에 몸이 무거운 분', '하루를 가볍게 시작하고 싶은 분'],
    avoidIf: ['아직 몸이 굳어 있는데 갑자기 크게 움직이려는 경우'],
    defaultMinutes: 12,
    minMinutes: 10,
    maxMinutes: 40,
    structure: ['처음: 목과 어깨부터 작게', '중간: 걷듯이 몸 전체를 깨우기', '마무리: 호흡 정리'],
    summary: '작은 움직임으로 몸을 천천히 깨워요.',
  },
  {
    id: 'walk',
    title: '걷기',
    aliases: [],
    category: '회복',
    countsAs: 'walk',
    purpose: '시선과 호흡을 편안하게 두고 걷기만으로 오늘의 움직임을 채워요.',
    intensityLabel: '평소 산책보다 살짝 빠른 정도',
    rpe: { min: 2, max: 3 },
    bestFor: ['달리기가 부담스러운 날', '기록을 이어가고 싶은 날'],
    avoidIf: ['걷기도 통증이 느껴지는 날'],
    defaultMinutes: 30,
    minMinutes: 10,
    maxMinutes: 120,
    structure: ['처음: 천천히 출발', '중간: 편안한 보폭 유지', '마무리: 호흡 정리'],
    summary: '시선과 호흡을 편안하게 두고 걸어요.',
  },
];

const typeById = new Map<RunningTypeId, RunningTypeDefinition>(
  runningTypes.map((type) => [type.id, type]),
);

const typeByTitle = new Map<string, RunningTypeDefinition>();
for (const type of runningTypes) {
  typeByTitle.set(type.title, type);
  for (const alias of type.aliases) typeByTitle.set(alias, type);
}

/** 구 CoachSessionKind 이름과 새 RunningTypeId를 모두 받아 유형 정의로 바꿉니다. */
export function resolveRunningType(
  value: CoachSessionKind | RunningTypeId | string,
): RunningTypeDefinition {
  return (
    typeById.get(value as RunningTypeId) ??
    typeByTitle.get(value) ??
    (typeById.get('easy') as RunningTypeDefinition)
  );
}

export function runningTypeById(id: RunningTypeId): RunningTypeDefinition {
  return typeById.get(id) as RunningTypeDefinition;
}

export function runningTypesByCategory(
  category: RunningTypeCategory,
): RunningTypeDefinition[] {
  return runningTypes.filter((type) => type.category === category);
}

/** 구 이름 → 새 유형 매핑 테이블입니다(하위호환 확인용). */
export const legacyKindMap: Record<string, RunningTypeId> = Object.fromEntries(
  runningTypes.flatMap((type) => type.aliases.map((alias) => [alias, type.id])),
);

function clampSeconds(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

type PhaseDraft = Omit<SessionPhase, 'index'>;

function repeatBlocks(
  from: number,
  to: number,
  blocks: { kind: PhaseKind; label: string; seconds: number }[],
): PhaseDraft[] {
  const drafts: PhaseDraft[] = [];
  const cycleSeconds = blocks.reduce((total, block) => total + block.seconds, 0);
  const totalReps = Math.max(1, Math.floor((to - from) / cycleSeconds));
  let cursor = from;
  for (let rep = 0; rep < totalReps; rep += 1) {
    for (const block of blocks) {
      const end = Math.min(to, cursor + block.seconds);
      if (end > cursor) {
        drafts.push({
          kind: block.kind,
          label: `${block.label} ${rep + 1}/${totalReps}`,
          startSeconds: cursor,
          endSeconds: end,
          repIndex: rep + 1,
          totalReps,
        });
      }
      cursor = end;
    }
  }
  if (cursor < to && drafts.length > 0) {
    drafts[drafts.length - 1].endSeconds = to;
  }
  return drafts;
}

function splitEvenly(
  from: number,
  to: number,
  labels: string[],
  kind: PhaseKind,
): PhaseDraft[] {
  const span = (to - from) / labels.length;
  return labels.map((label, index) => ({
    kind,
    label,
    startSeconds: Math.round(from + span * index),
    endSeconds: index === labels.length - 1 ? to : Math.round(from + span * (index + 1)),
  }));
}

/** 유형과 총 시간으로 워밍업·본운동·쿨다운 구간 타임라인을 만듭니다. */
export function buildPhases(
  id: RunningTypeId,
  durationSeconds: number,
): SessionPhase[] {
  const total = Math.max(60, Math.round(durationSeconds));
  const drafts: PhaseDraft[] = [];

  const warm = (ratio: number, min: number, max: number) =>
    clampSeconds(total * ratio, Math.min(min, Math.floor(total * 0.2)), max);

  const addWarmup = (seconds: number, label = '워밍업') => {
    drafts.push({ kind: 'warmup', label, startSeconds: 0, endSeconds: seconds });
  };
  const addCooldown = (from: number, label = '쿨다운') => {
    drafts.push({ kind: 'cooldown', label, startSeconds: from, endSeconds: total });
  };

  switch (id) {
    case 'long': {
      const warmup = warm(0.1, 120, 480);
      const cooldown = warm(0.08, 120, 360);
      addWarmup(warmup);
      drafts.push(
        ...splitEvenly(warmup, total - cooldown, ['초반 구간', '중반 구간', '후반 구간'], 'steady'),
      );
      addCooldown(total - cooldown);
      break;
    }
    case 'tempo': {
      const warmup = warm(0.2, 240, 720);
      const cooldown = warm(0.15, 180, 600);
      addWarmup(warmup, '워밍업 조깅');
      const mainStart = warmup;
      const mainEnd = total - cooldown;
      if (mainEnd - mainStart > 900) {
        const half = Math.round((mainEnd - mainStart - 90) / 2);
        drafts.push({ kind: 'work', label: '템포 블록 1/2', startSeconds: mainStart, endSeconds: mainStart + half });
        drafts.push({ kind: 'recovery', label: '사이 회복 조깅', startSeconds: mainStart + half, endSeconds: mainStart + half + 90 });
        drafts.push({ kind: 'work', label: '템포 블록 2/2', startSeconds: mainStart + half + 90, endSeconds: mainEnd });
      } else {
        drafts.push({ kind: 'work', label: '템포 구간', startSeconds: mainStart, endSeconds: mainEnd });
      }
      addCooldown(mainEnd);
      break;
    }
    case 'interval': {
      const warmup = warm(0.2, 240, 600);
      const cooldown = warm(0.15, 180, 480);
      addWarmup(warmup, '워밍업 조깅');
      const reps = repeatBlocks(warmup, total - cooldown, [
        { kind: 'work', label: '빠른 구간', seconds: 60 },
        { kind: 'recovery', label: '회복 구간', seconds: 90 },
      ]);
      drafts.push(...reps);
      addCooldown(reps.length > 0 ? reps[reps.length - 1].endSeconds : warmup);
      break;
    }
    case 'fartlek': {
      const warmup = warm(0.15, 180, 480);
      const cooldown = warm(0.12, 150, 360);
      addWarmup(warmup);
      const reps = repeatBlocks(warmup, total - cooldown, [
        { kind: 'surge', label: '빠른 놀이 구간', seconds: 75 },
        { kind: 'steady', label: '편한 구간', seconds: 135 },
      ]);
      drafts.push(...reps);
      addCooldown(reps.length > 0 ? reps[reps.length - 1].endSeconds : warmup);
      break;
    }
    case 'progression': {
      const warmup = warm(0.12, 150, 480);
      const cooldown = warm(0.12, 150, 420);
      addWarmup(warmup);
      drafts.push(
        ...splitEvenly(warmup, total - cooldown, ['1단계 편안하게', '2단계 조금 올려서', '3단계 마무리 상승'], 'build'),
      );
      addCooldown(total - cooldown);
      break;
    }
    case 'hill': {
      const warmup = warm(0.25, 300, 720);
      const cooldown = warm(0.2, 240, 600);
      addWarmup(warmup, '평지 워밍업');
      const reps = repeatBlocks(warmup, total - cooldown, [
        { kind: 'climb', label: '오르막', seconds: 45 },
        { kind: 'descent', label: '내리막 회복', seconds: 105 },
      ]);
      drafts.push(...reps);
      addCooldown(reps.length > 0 ? reps[reps.length - 1].endSeconds : warmup);
      break;
    }
    case 'strides': {
      const warmup = warm(0.4, 360, 900);
      const cooldown = warm(0.2, 180, 480);
      addWarmup(warmup, '워밍업 조깅');
      const reps = repeatBlocks(warmup, total - cooldown, [
        { kind: 'stride', label: '스트라이드', seconds: 20 },
        { kind: 'recovery', label: '회복 조깅', seconds: 100 },
      ]);
      drafts.push(...reps);
      addCooldown(reps.length > 0 ? reps[reps.length - 1].endSeconds : warmup);
      break;
    }
    case 'walkRun': {
      const warmup = warm(0.1, 120, 300);
      const cooldown = warm(0.1, 120, 300);
      drafts.push({ kind: 'walk', label: '워밍업 걷기', startSeconds: 0, endSeconds: warmup });
      const reps = repeatBlocks(warmup, total - cooldown, [
        { kind: 'work', label: '달리기 구간', seconds: 60 },
        { kind: 'walk', label: '걷기 회복', seconds: 90 },
      ]);
      drafts.push(...reps);
      addCooldown(reps.length > 0 ? reps[reps.length - 1].endSeconds : warmup, '마무리 걷기');
      break;
    }
    case 'treadmill': {
      const warmup = warm(0.15, 180, 480);
      const cooldown = warm(0.15, 180, 480);
      addWarmup(warmup, '속도 올리기');
      drafts.push({ kind: 'steady', label: '목표 속도 유지', startSeconds: warmup, endSeconds: total - cooldown });
      addCooldown(total - cooldown, '속도 낮추기');
      break;
    }
    case 'taper': {
      const warmup = warm(0.2, 180, 420);
      const cooldown = warm(0.16, 150, 360);
      addWarmup(warmup);
      const strideStart = Math.max(warmup, total - cooldown - 240);
      drafts.push({ kind: 'steady', label: '짧은 이지런', startSeconds: warmup, endSeconds: strideStart });
      const reps = repeatBlocks(strideStart, total - cooldown, [
        { kind: 'stride', label: '스트라이드', seconds: 20 },
        { kind: 'recovery', label: '회복 조깅', seconds: 60 },
      ]);
      drafts.push(...reps);
      addCooldown(reps.length > 0 ? reps[reps.length - 1].endSeconds : strideStart);
      break;
    }
    case 'recoveryWalk':
    case 'walk': {
      const warmup = warm(0.12, 90, 240);
      const cooldown = warm(0.12, 90, 240);
      drafts.push({ kind: 'walk', label: '천천히 출발', startSeconds: 0, endSeconds: warmup });
      drafts.push({ kind: 'walk', label: '편안한 걸음', startSeconds: warmup, endSeconds: total - cooldown });
      addCooldown(total - cooldown, '호흡 정리');
      break;
    }
    case 'mobility':
    case 'wakeup': {
      const warmup = warm(0.2, 90, 240);
      const cooldown = warm(0.2, 90, 240);
      drafts.push({ kind: 'mobility', label: '호흡부터 천천히', startSeconds: 0, endSeconds: warmup });
      drafts.push({ kind: 'mobility', label: '부드러운 움직임', startSeconds: warmup, endSeconds: total - cooldown });
      addCooldown(total - cooldown, '마무리 정리');
      break;
    }
    case 'easy':
    default: {
      const warmup = warm(0.12, 150, 480);
      const cooldown = warm(0.1, 120, 360);
      addWarmup(warmup);
      drafts.push({ kind: 'steady', label: '지속주 구간', startSeconds: warmup, endSeconds: total - cooldown });
      addCooldown(total - cooldown);
      break;
    }
  }

  return drafts
    .filter((draft) => draft.endSeconds > draft.startSeconds)
    .map((draft, index) => ({ ...draft, index }));
}
