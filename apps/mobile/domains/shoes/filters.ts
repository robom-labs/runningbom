// 러닝화 탐색 화면의 검색·필터·정렬 규칙입니다.
// react-native에 의존하지 않는 순수 함수로 유지해 단위 테스트에서 그대로 검증합니다.
import { shoeCatalog, shoeSearchText, type ShoeEntry } from './catalog';
import {
  shoeBrands,
  shoePriceBands,
  type ShoeBrand,
  type ShoeCategory,
  type ShoeDistance,
  type ShoeLevel,
  type ShoePlate,
  type ShoePriceBand,
  type ShoeSubCategory,
} from './taxonomy';

// 정가는 확인된 소수의 모델에만 있어 값으로 줄을 세울 수 없습니다.
// 그래서 "가격"이 아니라 모든 항목이 가진 가격대(밴드) 구간으로만 정렬합니다.
export type ShoeSort =
  | '추천순'
  | '이름순'
  | '가격대 낮은 순'
  | '가격대 높은 순'
  | '브랜드순';
export const shoeSorts: readonly ShoeSort[] = [
  '추천순',
  '이름순',
  '가격대 낮은 순',
  '가격대 높은 순',
  '브랜드순',
];

/** 플레이트 필터는 유무 기준(있음/없음)으로 다루되 종류 선택도 지원합니다. */
export type ShoePlateFilter = 'none' | 'light' | 'carbon' | 'any-plate';
export const shoePlateFilters: readonly ShoePlateFilter[] = ['none', 'any-plate', 'light', 'carbon'];
export const shoePlateFilterLabels: Readonly<Record<ShoePlateFilter, string>> = {
  none: '플레이트 없음',
  'any-plate': '플레이트 있음',
  light: '라이트 플레이트',
  carbon: '카본 플레이트',
};

export type ShoeFilterState = {
  query: string;
  /** undefined이면 전체 카테고리 */
  category?: ShoeCategory;
  subCategories: ShoeSubCategory[];
  brands: ShoeBrand[];
  levels: ShoeLevel[];
  distances: ShoeDistance[];
  priceBands: ShoePriceBand[];
  plates: ShoePlateFilter[];
  sort: ShoeSort;
};

export const emptyShoeFilterState: ShoeFilterState = {
  query: '',
  category: undefined,
  subCategories: [],
  brands: [],
  levels: [],
  distances: [],
  priceBands: [],
  plates: [],
  sort: '추천순',
};

export function resetShoeFilters(): ShoeFilterState {
  return { ...emptyShoeFilterState, subCategories: [], brands: [], levels: [], distances: [], priceBands: [], plates: [] };
}

export function toggleValue<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function activeFilterCount(state: ShoeFilterState): number {
  return (
    (state.query.trim() ? 1 : 0) +
    (state.category ? 1 : 0) +
    state.subCategories.length +
    state.brands.length +
    state.levels.length +
    state.distances.length +
    state.priceBands.length +
    state.plates.length
  );
}

function matchesPlate(entry: ShoeEntry, filters: ShoePlateFilter[]): boolean {
  if (filters.length === 0) return true;
  return filters.some((filter) => {
    if (filter === 'any-plate') return entry.plate !== 'none';
    return entry.plate === (filter as ShoePlate);
  });
}

function matchesQuery(entry: ShoeEntry, query: string): boolean {
  const normalized = query.trim().toLocaleLowerCase('ko-KR');
  if (!normalized) return true;
  return normalized
    .split(/\s+/)
    .every((token) => shoeSearchText(entry).includes(token));
}

const brandOrder = new Map<ShoeBrand, number>(shoeBrands.map((brand, index) => [brand, index]));
const priceBandOrder = new Map<ShoePriceBand, number>(
  shoePriceBands.map((band, index) => [band, index]),
);

function compare(left: ShoeEntry, right: ShoeEntry, sort: ShoeSort, order: Map<string, number>): number {
  if (sort === '브랜드순') {
    const byBrand = (brandOrder.get(left.brand) ?? 0) - (brandOrder.get(right.brand) ?? 0);
    if (byBrand !== 0) return byBrand;
    return left.model.localeCompare(right.model, 'ko-KR');
  }
  if (sort === '이름순') {
    const byModel = left.model.localeCompare(right.model, 'ko-KR');
    if (byModel !== 0) return byModel;
    return left.brand.localeCompare(right.brand);
  }
  if (sort === '가격대 낮은 순' || sort === '가격대 높은 순') {
    const leftBand = priceBandOrder.get(left.priceBand) ?? 0;
    const rightBand = priceBandOrder.get(right.priceBand) ?? 0;
    const byBand = sort === '가격대 낮은 순' ? leftBand - rightBand : rightBand - leftBand;
    if (byBand !== 0) return byBand;
    // 같은 밴드 안에서는 정본 순서를 유지해 결과가 항상 결정적이도록 둡니다.
    return (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0);
  }
  // 추천순: 카탈로그 정본 순서(데일리 → 슈퍼트레이너 → 레이싱)를 그대로 씁니다.
  return (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0);
}

export function filterShoes(
  state: ShoeFilterState,
  values: ShoeEntry[] = shoeCatalog,
  options: { pinnedId?: string } = {},
): ShoeEntry[] {
  const order = new Map(values.map((entry, index) => [entry.id, index] as const));
  const matched = values.filter((entry) => {
    if (state.category && entry.category !== state.category) return false;
    if (state.subCategories.length > 0 && !state.subCategories.includes(entry.subCategory)) return false;
    if (state.brands.length > 0 && !state.brands.includes(entry.brand)) return false;
    if (state.levels.length > 0 && !state.levels.some((level) => entry.levels.includes(level))) return false;
    if (state.distances.length > 0 && !state.distances.some((distance) => entry.distances.includes(distance))) {
      return false;
    }
    if (state.priceBands.length > 0 && !state.priceBands.includes(entry.priceBand)) return false;
    if (!matchesPlate(entry, state.plates)) return false;
    return matchesQuery(entry, state.query);
  });

  const sorted = [...matched].sort((left, right) => compare(left, right, state.sort, order));
  if (!options.pinnedId) return sorted;
  return [...sorted].sort((left, right) => {
    if (left.id === options.pinnedId) return -1;
    if (right.id === options.pinnedId) return 1;
    return 0;
  });
}

// ---------------------------------------------------------------------------
// 0건일 때 "왜 없는지 + 하나만 풀면 되는지"를 말해 주기 위한 도구입니다.
// 사용자가 어떤 칩을 눌러야 결과가 생기는지 화면이 직접 계산해서 알려 줍니다.
// ---------------------------------------------------------------------------

export type ShoeFilterDimension =
  | 'query'
  | 'category'
  | 'subCategories'
  | 'brands'
  | 'levels'
  | 'distances'
  | 'priceBands'
  | 'plates';

export const shoeFilterDimensionLabels: Readonly<Record<ShoeFilterDimension, string>> = {
  query: '검색어',
  category: '갈래',
  subCategories: '세부 갈래',
  brands: '브랜드',
  levels: '실력',
  distances: '거리',
  priceBands: '가격대',
  plates: '플레이트(밑창 속에 넣는 단단한 판)',
};

/** 지금 켜져 있는 필터 축들. 화면 순서와 같게 유지합니다. */
export function activeFilterDimensions(state: ShoeFilterState): ShoeFilterDimension[] {
  const active: ShoeFilterDimension[] = [];
  if (state.query.trim()) active.push('query');
  if (state.category) active.push('category');
  if (state.subCategories.length > 0) active.push('subCategories');
  if (state.brands.length > 0) active.push('brands');
  if (state.levels.length > 0) active.push('levels');
  if (state.distances.length > 0) active.push('distances');
  if (state.priceBands.length > 0) active.push('priceBands');
  if (state.plates.length > 0) active.push('plates');
  return active;
}

/** 축 하나만 푼 상태를 만듭니다. 다른 축은 그대로 둡니다. */
export function clearFilterDimension(
  state: ShoeFilterState,
  dimension: ShoeFilterDimension,
): ShoeFilterState {
  switch (dimension) {
    case 'query':
      return { ...state, query: '' };
    case 'category':
      // 갈래를 풀면 그 갈래에서만 의미가 있던 세부 갈래도 함께 풉니다.
      return { ...state, category: undefined, subCategories: [] };
    case 'subCategories':
      return { ...state, subCategories: [] };
    case 'brands':
      return { ...state, brands: [] };
    case 'levels':
      return { ...state, levels: [] };
    case 'distances':
      return { ...state, distances: [] };
    case 'priceBands':
      return { ...state, priceBands: [] };
    case 'plates':
      return { ...state, plates: [] };
  }
}

export type ShoeEmptyAdvice = {
  /** 풀어 보라고 권할 축 */
  dimension: ShoeFilterDimension;
  label: string;
  /** 그 축만 풀었을 때 나오는 개수 */
  count: number;
};

/**
 * 결과가 0건일 때, "이것 하나만 풀면 N개가 나와요"를 계산합니다.
 * 하나만 풀어도 여전히 0건이면 undefined를 돌려주고 화면은 전체 초기화를 권합니다.
 */
export function emptyResultAdvice(
  state: ShoeFilterState,
  values: ShoeEntry[] = shoeCatalog,
): ShoeEmptyAdvice | undefined {
  let best: ShoeEmptyAdvice | undefined;
  for (const dimension of activeFilterDimensions(state)) {
    const count = filterShoes(clearFilterDimension(state, dimension), values).length;
    if (count === 0) continue;
    if (!best || count > best.count) {
      best = { dimension, label: shoeFilterDimensionLabels[dimension], count };
    }
  }
  return best;
}

export function countByCategory(values: ShoeEntry[] = shoeCatalog): Record<ShoeCategory, number> {
  const counts = { 데일리: 0, 슈퍼트레이너: 0, 레이싱: 0 } as Record<ShoeCategory, number>;
  for (const entry of values) counts[entry.category] += 1;
  return counts;
}

export function countByBrand(values: ShoeEntry[] = shoeCatalog): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of values) counts[entry.brand] = (counts[entry.brand] ?? 0) + 1;
  return counts;
}
