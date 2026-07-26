// 러닝화 탐색 화면의 검색·필터·정렬 규칙입니다.
// react-native에 의존하지 않는 순수 함수로 유지해 단위 테스트에서 그대로 검증합니다.
import { shoeCatalog, shoeSearchText, type ShoeEntry } from './catalog';
import {
  shoeBrands,
  type ShoeBrand,
  type ShoeCategory,
  type ShoeDistance,
  type ShoeLevel,
  type ShoePlate,
  type ShoePriceBand,
  type ShoeSubCategory,
} from './taxonomy';

export type ShoeSort = '추천순' | '브랜드순' | '이름순';
export const shoeSorts: readonly ShoeSort[] = ['추천순', '브랜드순', '이름순'];

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
