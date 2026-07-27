// 러닝을 마친 뒤 남기는 한 줄 회고입니다.
//
// 회장 지시: **"이모지 난이도, 이것도 좀 바꾸고."**
//
// 왜 이모지를 바꾸는가:
//   😀😐😫 다섯 개를 늘어놓으면 사람마다 다르게 읽습니다. 어떤 사람의 😐가
//   다른 사람의 😫입니다. 그리고 무엇보다 — **그 값으로 아무것도 하지 않으면
//   묻는 것 자체가 시간 낭비입니다.**
//
// 그래서 두 가지를 바꿉니다.
//   1. 이모지 대신 **말로 고르는 3지선다.** 셋이면 헷갈리지 않고, 말이면 뜻이 하나입니다.
//   2. **이 값이 실제로 내일 제안을 바꿉니다.** 이게 없으면 회고는 그냥 설문입니다.
//
// 이 파일은 순수합니다.

/** 오늘 어땠는지. 셋뿐입니다. */
export type EffortId = 'easy' | 'right' | 'hard';

export type EffortChoice = {
  id: EffortId;
  label: string;
  /** 고를 때 보이는 한 줄입니다. */
  hint: string;
};

export const effortChoices: EffortChoice[] = [
  { id: 'easy', label: '가벼웠어요', hint: '더 할 수 있을 것 같았어요' },
  { id: 'right', label: '딱 맞았어요', hint: '힘들었지만 끝까지 갔어요' },
  { id: 'hard', label: '힘들었어요', hint: '중간에 멈추고 싶었어요' },
];

/**
 * 몸 상태 꼬리표입니다. 여러 개 고를 수 있습니다.
 *
 * 아픈 곳을 고르는 것이 아니라 **느낌**을 고릅니다.
 * 우리는 의료 판단을 하지 않습니다. 다만 "무릎이 시큰했다"가 이틀 이어지면
 * 쉬라고 말할 수는 있습니다.
 */
export type BodyTagId = 'fine' | 'knee' | 'shin' | 'ankle' | 'breath' | 'tired';

export type BodyTag = {
  id: BodyTagId;
  label: string;
  /** 이 꼬리표가 쉬라는 신호인지입니다. */
  caution: boolean;
};

export const bodyTags: BodyTag[] = [
  { id: 'fine', label: '괜찮았어요', caution: false },
  { id: 'knee', label: '무릎이 시큰', caution: true },
  { id: 'shin', label: '정강이가 아픔', caution: true },
  { id: 'ankle', label: '발목이 불편', caution: true },
  { id: 'breath', label: '숨이 많이 찼어요', caution: false },
  { id: 'tired', label: '몸이 무거웠어요', caution: false },
];

export type Retrospect = {
  effort: EffortId;
  bodyTagIds: BodyTagId[];
};

/** '괜찮았어요'를 고르면 나머지 꼬리표는 뜻이 없어집니다. 같이 고르지 못하게 합니다. */
export function toggleBodyTag(current: BodyTagId[], tag: BodyTagId): BodyTagId[] {
  if (current.includes(tag)) return current.filter((value) => value !== tag);
  if (tag === 'fine') return ['fine'];
  return [...current.filter((value) => value !== 'fine'), tag];
}

export function hasCaution(tagIds: BodyTagId[]): boolean {
  return tagIds.some((id) => bodyTags.find((tag) => tag.id === id)?.caution === true);
}

/**
 * 회고에서 나온 **오늘 제안에 대한 조정**입니다.
 *
 * 이 함수가 있어서 회고가 설문이 아니게 됩니다.
 * 반환값은 "제안을 얼마나 눌러야 하는가"입니다.
 *   - 'rest'   오늘은 쉬라고 말합니다
 *   - 'easier' 원래 제안보다 가벼운 것을 권합니다
 *   - 'same'   그대로 갑니다
 *   - 'ready'  더 해도 괜찮다는 신호입니다(다만 늘리라고 밀어붙이지는 않습니다)
 */
export type SuggestionAdjust = 'rest' | 'easier' | 'same' | 'ready';

export type AdjustInput = {
  /** 최근 회고입니다. 새것이 앞입니다. */
  recent: Retrospect[];
};

/**
 * 판단 순서가 곧 안전 규칙입니다. 위에 있는 조건일수록 먼저 지켜집니다.
 *   1) 아픈 신호가 이어지면 쉰다
 *   2) 한 번이라도 아픈 신호가 있으면 가볍게 간다
 *   3) 힘들었다가 이어지면 가볍게 간다
 *   4) 가벼웠다가 이어지면 준비된 것으로 본다
 */
export function adjustFromRetrospects(input: AdjustInput): SuggestionAdjust {
  const recent = input.recent.slice(0, 3);
  if (recent.length === 0) return 'same';

  const cautionCount = recent.filter((item) => hasCaution(item.bodyTagIds)).length;
  // 아픈 신호가 두 번 이어지면 그냥 쉬는 게 맞습니다. 참고 뛰면 오래 못 뜁니다.
  if (cautionCount >= 2) return 'rest';
  if (cautionCount >= 1) return 'easier';

  const lastTwo = recent.slice(0, 2);
  if (lastTwo.length === 2 && lastTwo.every((item) => item.effort === 'hard')) return 'easier';
  if (lastTwo.length === 2 && lastTwo.every((item) => item.effort === 'easy')) return 'ready';

  return 'same';
}

/** 왜 그렇게 조정했는지 화면에 쓸 말입니다. 근거 없는 조정은 신뢰를 잃습니다. */
export const adjustReasons: Record<SuggestionAdjust, string> = {
  rest: '최근에 아픈 데가 있다고 하셨어요. 오늘은 쉬는 게 맞아요.',
  easier: '지난번에 힘드셨다고 해서 오늘은 가볍게 잡았어요.',
  same: '지난번 기록을 보고 정한 오늘 몫이에요.',
  ready: '최근 두 번 다 가벼웠다고 하셨어요. 오늘은 조금 더 해도 괜찮아요.',
};
