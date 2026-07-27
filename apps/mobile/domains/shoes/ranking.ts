// 러닝화 순위입니다.
//
// 회장 지시: **"신발 순위도 메인 화면 아래쪽에 있고 얼마나 좋아."**
//
// "순위"라는 말을 쓰는 순간 우리는 **근거를 밝힐 의무**를 집니다.
// 근거 없는 순위는 신뢰를 한 번에 잃고, 한 번 잃으면 되찾을 수 없습니다.
// 그래서 산식을 이 파일에 적고, **앱 화면에서도 그대로 열어 보여 줍니다.**
//
// 우리가 쓰지 않는 것:
//   - 판매량 (우리는 팔지 않아서 모릅니다)
//   - 협찬·광고 (돈으로 순위를 바꾸지 않습니다)
//   - 사용자 별점 (사용자가 아직 적기 때문에 몇 사람이 순위를 흔듭니다)
//
// 우리가 쓰는 것: 전부 우리가 이미 가진, 검증 가능한 값입니다.
//
// 이 파일은 순수합니다.
import type { ShoePrice } from './price';
import type { ShoeLevel, ShoeSubCategory } from './taxonomy';

/** 산식 설명입니다. 순위 헤더를 누르면 이 표가 그대로 열립니다. */
export const rankingCriteria: { label: string; weight: number; why: string }[] = [
  { label: '실력에 맞는 정도', weight: 40, why: '지금 내 수준에서 신을 수 있는 신발인지' },
  { label: '가격 확인', weight: 20, why: '정가를 확인했는지, 최근에 확인했는지' },
  { label: '정보 완성도', weight: 20, why: '언제 신는지·누구에게 맞는지가 채워졌는지' },
  { label: '국내 구입', weight: 20, why: '국내 공식으로 살 수 있는지' },
];

export const RANKING_DISCLOSURE =
  '광고나 협찬으로 순위를 바꾸지 않아요. 판매량도 쓰지 않아요. 위 네 가지로만 매겨요.';

export type RankableShoe = {
  id: string;
  brand: string;
  model: string;
  subCategory: ShoeSubCategory;
  levels: ShoeLevel[];
  price?: ShoePrice;
  status?: string;
  /** 심화 정보 필드가 채워졌는지 세는 데 씁니다. */
  useCase?: string;
  bestForRunner?: string[];
  notFor?: string[];
  keyTech?: string[];
  fitNote?: string;
  comparedTo?: string[];
};

export type RankedShoe<T extends RankableShoe = RankableShoe> = {
  shoe: T;
  score: number;
  rank: number;
};

const DETAIL_FIELDS = 6;

function detailScore(shoe: RankableShoe): number {
  let filled = 0;
  if (shoe.useCase) filled += 1;
  if (shoe.fitNote) filled += 1;
  if (shoe.bestForRunner?.length) filled += 1;
  if (shoe.notFor?.length) filled += 1;
  if (shoe.keyTech?.length) filled += 1;
  if (shoe.comparedTo?.length) filled += 1;
  return filled / DETAIL_FIELDS;
}

function priceScore(shoe: RankableShoe, now: Date): number {
  if (!shoe.price) return 0;
  const checked = new Date(`${shoe.price.checkedAt}T00:00:00Z`);
  if (Number.isNaN(checked.getTime())) return 0.5;
  const days = Math.floor((now.getTime() - checked.getTime()) / 86_400_000);
  // 최근에 확인했을수록 높습니다. 반년이 지나면 절반만 인정합니다.
  return days <= 180 ? 1 : 0.5;
}

function levelScore(shoe: RankableShoe, level: ShoeLevel | undefined): number {
  if (!level) return 0.6;
  return shoe.levels.includes(level) ? 1 : 0.2;
}

function koreaScore(shoe: RankableShoe): number {
  // 해외에서만 파는 신발을 위에 올리면, 눌러 보고 못 사는 경험만 남습니다.
  return shoe.status === 'global-only' ? 0.2 : 1;
}

export type RankingInput = {
  /** 지금 사용자 수준입니다. 모르면 전체 평균으로 봅니다. */
  level?: ShoeLevel;
  /** 이 갈래만 볼 때 씁니다. 없으면 전체입니다. */
  subCategory?: ShoeSubCategory;
  limit?: number;
};

/**
 * 순위를 매깁니다.
 *
 * **정가 미확인이라고 목록에서 빼지는 않습니다.** 빼면 순위가 텅 비고, 텅 빈 순위는
 * 아무에게도 쓸모가 없습니다. 대신 "가격 확인" 20점을 못 받으므로 **자연히 아래로 밀립니다.**
 * 그래서 가격을 채우면 올라가고, 안 채우면 내려갑니다 — 채울 이유가 구조에 들어갑니다.
 *
 * 순위에 오른 모든 신발은 `priceDisplay()`로 **반드시 숫자가 보입니다**(정가 아니면 가격대 범위).
 * 값이 안 보이는 줄은 순위에 나오지 않습니다.
 */
export function rankShoes<T extends RankableShoe>(
  shoes: T[],
  input: RankingInput,
  now: Date,
): RankedShoe<T>[] {
  const pool = shoes.filter(
    (shoe) => !input.subCategory || shoe.subCategory === input.subCategory,
  );

  const scored = pool.map((shoe) => ({
    shoe,
    score:
      levelScore(shoe, input.level) * 40 +
      priceScore(shoe, now) * 20 +
      detailScore(shoe) * 20 +
      koreaScore(shoe) * 20,
  }));

  scored.sort(
    (left, right) =>
      right.score - left.score ||
      // 점수가 같으면 싼 것부터. 가격 때문에 고민하는 사람이 대부분입니다.
      (left.shoe.price?.listKrw ?? 0) - (right.shoe.price?.listKrw ?? 0) ||
      left.shoe.id.localeCompare(right.shoe.id),
  );

  return scored
    .slice(0, input.limit ?? scored.length)
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

/** 지난주 순위와 견줘 몇 칸 올랐는지입니다. 매주 바뀌는 것이 보여야 다시 옵니다. */
export function rankDelta(
  id: string,
  currentRank: number,
  previousOrder: string[] | undefined,
): { direction: 'up' | 'down' | 'same' | 'new'; steps: number } {
  if (!previousOrder) return { direction: 'same', steps: 0 };
  const previousIndex = previousOrder.indexOf(id);
  if (previousIndex < 0) return { direction: 'new', steps: 0 };
  const steps = previousIndex + 1 - currentRank;
  if (steps > 0) return { direction: 'up', steps };
  if (steps < 0) return { direction: 'down', steps: -steps };
  return { direction: 'same', steps: 0 };
}

export function rankDeltaLabel(delta: ReturnType<typeof rankDelta>): string {
  if (delta.direction === 'new') return '새로 들어옴';
  if (delta.direction === 'up') return `${delta.steps}칸 올라옴`;
  if (delta.direction === 'down') return `${delta.steps}칸 내려감`;
  return '그대로';
}
