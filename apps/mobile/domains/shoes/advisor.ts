// "뭘 사야 할지 모르겠다"는 사용자를 위한 러닝화 추천 마법사의 순수 로직입니다.
//
// 규칙
// - react-native에 의존하지 않는 순수 함수만 둡니다(단위 테스트에서 그대로 검증합니다).
// - 카탈로그에 이미 있는 분류값(카테고리/세부/실력/거리/가격대/용도 태그)만 근거로 씁니다.
//   여기서 새로운 수치나 스펙을 만들어 내지 않습니다.
// - 안전선: 러닝 경력이 짧은 사용자에게 레이싱 대회화·카본 플레이트는 추천 목록에서 제외합니다.
import { shoeCatalog, type ShoeEntry } from './catalog';
import type { ShoeDistance, ShoeLevel, ShoePriceBand } from './taxonomy';

export type AdvisorExperience = '입문' | '1년내' | '1년이상';
export type AdvisorGoal = '건강조깅' | '대회준비' | '스피드훈련';
export type AdvisorDistance = '5K이하' | '10K' | '하프이상';
export type AdvisorBudget = '엔트리' | '미들' | '하이이상' | '상관없음';

export type AdvisorAnswers = {
  experience: AdvisorExperience;
  goal: AdvisorGoal;
  distance: AdvisorDistance;
  budget: AdvisorBudget;
};

export type AdvisorQuestion<K extends keyof AdvisorAnswers = keyof AdvisorAnswers> = {
  key: K;
  title: string;
  help: string;
  options: { value: AdvisorAnswers[K]; label: string; hint: string }[];
};

/** 화면이 그대로 렌더할 수 있도록 질문 정의도 여기에 둡니다(문구와 로직을 한곳에서 관리). */
export const advisorQuestions: AdvisorQuestion[] = [
  {
    key: 'experience',
    title: '러닝을 얼마나 하셨나요?',
    help: '경력에 따라 안전하게 권할 수 있는 신발의 범위가 달라져요.',
    options: [
      { value: '입문', label: '이제 시작했어요', hint: '아직 꾸준히 달리는 습관을 만드는 중' },
      { value: '1년내', label: '1년 안쪽이에요', hint: '주 2~3회 정도 달리는 중' },
      { value: '1년이상', label: '1년 넘었어요', hint: '훈련 종류를 나눠서 달리는 중' },
    ],
  },
  {
    key: 'goal',
    title: '주로 어떤 목적으로 달리시나요?',
    help: '목적이 바뀌면 같은 가격대에서도 고를 신발이 완전히 달라져요.',
    options: [
      { value: '건강조깅', label: '건강·체력 관리', hint: '편안한 페이스로 꾸준히' },
      { value: '대회준비', label: '대회 준비', hint: '목표 대회를 앞두고 훈련 중' },
      { value: '스피드훈련', label: '스피드 훈련', hint: '템포·인터벌을 정기적으로' },
    ],
  },
  {
    key: 'distance',
    title: '한 번에 주로 몇 km를 달리시나요?',
    help: '가장 자주 달리는 거리를 기준으로 골라 주세요.',
    options: [
      { value: '5K이하', label: '5km 이하', hint: '짧게 자주' },
      { value: '10K', label: '5~10km', hint: '가장 흔한 일상 러닝 거리' },
      { value: '하프이상', label: '10km 이상', hint: '하프·풀코스 거리까지' },
    ],
  },
  {
    key: 'budget',
    title: '예산은 어느 정도로 보시나요?',
    help: '러닝봄은 가격을 수집하지 않아 밴드 구간으로만 안내해요.',
    options: [
      { value: '엔트리', label: '엔트리 가격대', hint: '가장 부담 없는 구간' },
      { value: '미들', label: '미들 가격대', hint: '데일리화의 표준 구간' },
      { value: '하이이상', label: '하이 이상', hint: '슈퍼트레이너·대회화 포함' },
      { value: '상관없음', label: '상관없어요', hint: '성능 우선으로 보고 싶어요' },
    ],
  },
];

export type AdvisorRecommendation = {
  shoe: ShoeEntry;
  score: number;
  /** 왜 추천됐는지 한 줄 근거 */
  reason: string;
  /** 답변한 예산대를 넘는 후보인지(개수가 모자랄 때만 목록 뒤쪽에 들어옵니다) */
  overBudget: boolean;
};

const experienceLevels: Record<AdvisorExperience, ShoeLevel[]> = {
  입문: ['입문'],
  '1년내': ['입문', '중급'],
  '1년이상': ['중급', '상급'],
};

const distanceTargets: Record<AdvisorDistance, ShoeDistance[]> = {
  '5K이하': ['단거리', '5K'],
  '10K': ['5K', '10K'],
  '하프이상': ['10K', '하프', '풀', '장거리조깅'],
};

const budgetBands: Record<AdvisorBudget, ShoePriceBand[] | undefined> = {
  엔트리: ['엔트리'],
  미들: ['엔트리', '미들'],
  하이이상: ['엔트리', '미들', '하이', '프리미엄'],
  상관없음: undefined,
};

/**
 * 추천 대상에서 아예 빼는 안전선입니다.
 * - 러닝 경력이 짧으면 레이싱 대회화와 카본 플레이트는 권하지 않습니다.
 * - 건강 조깅이 목적이면 레이싱 대회화는 권하지 않습니다.
 */
export function isExcluded(entry: ShoeEntry, answers: AdvisorAnswers): boolean {
  if (answers.experience === '입문' && (entry.category === '레이싱' || entry.plate === 'carbon')) {
    return true;
  }
  if (answers.experience === '1년내' && entry.category === '레이싱') return true;
  if (answers.goal === '건강조깅' && entry.category === '레이싱') return true;
  return false;
}

type Signal = { hit: boolean; points: number; reason?: string };

function signals(entry: ShoeEntry, answers: AdvisorAnswers): Signal[] {
  const wantedLevels = experienceLevels[answers.experience];
  const wantedDistances = distanceTargets[answers.distance];
  const allowedBands = budgetBands[answers.budget];

  const levelHit = entry.levels.some((level) => wantedLevels.includes(level));
  const distanceHit = entry.distances.some((distance) => wantedDistances.includes(distance));
  const budgetHit = !allowedBands || allowedBands.includes(entry.priceBand);

  const goalHit =
    answers.goal === '건강조깅'
      ? entry.purposeTags.some((tag) => tag === '데일리조깅' || tag === '회복주')
      : answers.goal === '대회준비'
        ? entry.purposeTags.includes('대회레이스') || entry.category === '슈퍼트레이너'
        : entry.purposeTags.includes('스피드훈련');

  const goalReason =
    answers.goal === '건강조깅'
      ? '편안한 일상 조깅 용도로 분류된 신발'
      : answers.goal === '대회준비'
        ? '대회 준비 훈련·레이스 용도로 분류된 신발'
        : '스피드 훈련 용도로 분류된 신발';

  return [
    { hit: goalHit, points: 4, reason: goalReason },
    { hit: distanceHit, points: 3, reason: `${wantedDistances.join('·')} 거리에 어울리는 분류` },
    { hit: levelHit, points: 3, reason: `${wantedLevels.join('·')} 러너에게 권하는 자리` },
    { hit: budgetHit, points: allowedBands ? 2 : 0, reason: `${entry.priceBand} 가격대` },
    // 건강 조깅인데 지지 구조가 있는 신발이면 초보에게 도움이 되는 경우가 많아 소폭 가산합니다.
    {
      hit: answers.goal === '건강조깅' && entry.subCategory === '안정화',
      points: 1,
      reason: '자세가 흐트러질 때 잡아 주는 지지 구조',
    },
  ];
}

/** 답변한 예산대를 벗어나는지. 결과 카드에 그대로 표시해 사용자가 오해하지 않게 합니다. */
export function isOverBudget(entry: ShoeEntry, answers: AdvisorAnswers): boolean {
  const allowedBands = budgetBands[answers.budget];
  if (!allowedBands) return false;
  return !allowedBands.includes(entry.priceBand);
}

export function scoreShoe(entry: ShoeEntry, answers: AdvisorAnswers): number {
  const overBudget = isOverBudget(entry, answers);
  const base = signals(entry, answers).reduce(
    (total, signal) => total + (signal.hit ? signal.points : 0),
    0,
  );
  return base + (overBudget ? -6 : 0);
}

export const OVER_BUDGET_NOTE = '답변한 예산대보다 높은 구간이지만 조건이 잘 맞아 함께 보여 드려요.';

export function explainShoe(entry: ShoeEntry, answers: AdvisorAnswers): string {
  const reasons = signals(entry, answers)
    .filter((signal) => signal.hit && signal.reason)
    .map((signal) => signal.reason as string);
  const head =
    reasons.length === 0
      ? '조건과 가장 가깝게 남은 후보예요.'
      : `${reasons.slice(0, 3).join(' · ')}이라 골랐어요.`;
  return isOverBudget(entry, answers) ? `${head} ${OVER_BUDGET_NOTE}` : head;
}

export const ADVISOR_MIN_RESULTS = 5;
export const ADVISOR_MAX_RESULTS = 8;
/** 한 브랜드가 결과를 독식하지 않도록 상한을 둡니다. */
export const ADVISOR_MAX_PER_BRAND = 2;

/**
 * 답변을 카탈로그 필터링으로 바꿔 상위 5~8종을 돌려줍니다.
 * 같은 점수면 카탈로그 정본 순서를 따르므로 결과는 항상 결정적입니다.
 */
export function recommendShoeEntries(
  answers: AdvisorAnswers,
  values: ShoeEntry[] = shoeCatalog,
  limit: number = ADVISOR_MAX_RESULTS,
): AdvisorRecommendation[] {
  const order = new Map(values.map((entry, index) => [entry.id, index] as const));
  const ranked = values
    .filter((entry) => !isExcluded(entry, answers))
    .map((entry) => ({
      shoe: entry,
      score: scoreShoe(entry, answers),
      reason: explainShoe(entry, answers),
      overBudget: isOverBudget(entry, answers),
    }))
    .sort(
      (left, right) =>
        right.score - left.score || (order.get(left.shoe.id) ?? 0) - (order.get(right.shoe.id) ?? 0),
    );

  const perBrand = new Map<string, number>();
  const picked: AdvisorRecommendation[] = [];
  const overflow: AdvisorRecommendation[] = [];
  for (const candidate of ranked) {
    const used = perBrand.get(candidate.shoe.brand) ?? 0;
    if (used >= ADVISOR_MAX_PER_BRAND) {
      overflow.push(candidate);
      continue;
    }
    perBrand.set(candidate.shoe.brand, used + 1);
    picked.push(candidate);
    if (picked.length >= limit) break;
  }
  // 브랜드 상한 때문에 최소 개수를 못 채우면 넘친 후보로 보충합니다.
  for (const candidate of overflow) {
    if (picked.length >= Math.min(limit, ADVISOR_MIN_RESULTS)) break;
    picked.push(candidate);
  }
  return picked;
}

export const advisorInternals = { experienceLevels, distanceTargets, budgetBands, signals };
