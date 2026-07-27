// 러닝화 화면의 "안내된 탐색(guided browse)" 골격입니다.
//
// 왜 이 파일이 있나
// - 지금까지는 필터 칩을 잔뜩 나열하고 그 아래 카탈로그 전체를 쏟아 냈습니다. 목록이 많을수록
//   조잡해 보이는 구조라, 큰 갈래 → 세부 갈래 → 목록의 3단계로 먼저 좁히도록 골격을 바꿉니다.
// - 큰 갈래는 taxonomy.ts에 이미 있는 분류 축(데일리 / 슈퍼트레이너 / 레이싱)을 그대로 승격시킨
//   것이라 새 분류 체계를 만들지 않습니다.
//
// 규칙
// - react-native에 의존하지 않는 순수 데이터·함수만 둡니다(단위 테스트에서 그대로 검증합니다).
// - 여기서 무게·드롭·정가 같은 수치를 만들어 내지 않습니다. 개수는 항상 카탈로그에서 실측합니다.
// - 업계 용어(슈퍼 트레이너·플레이트·드롭·스택)는 반드시 괄호로 짧은 설명을 붙입니다.
import { shoeCatalog, type ShoeEntry } from './catalog';
import { emptyShoeFilterState, type ShoeFilterState, type ShoeSort } from './filters';
import {
  shoeCategories,
  shoeLevels,
  shoeSubCategories,
  type ShoeCategory,
  type ShoeDistance,
  type ShoeLevel,
  type ShoeSubCategory,
} from './taxonomy';

// ---------------------------------------------------------------------------
// 용어 풀이
// 화면 어디서든 같은 문장을 쓰도록 한곳에 모읍니다.
// ---------------------------------------------------------------------------

export const shoeGlossary = {
  플레이트: '플레이트(밑창 속에 넣는 단단한 판)',
  카본플레이트: '카본 플레이트(밑창 속에 넣는 아주 단단한 판)',
  드롭: '드롭(앞뒤 높이차)',
  스택: '스택(바닥 두께)',
  슈퍼트레이너: '슈퍼 트레이너(대회화 기술을 넣은 훈련용 신발)',
} as const;

// ---------------------------------------------------------------------------
// 1단계 · 큰 갈래 3개
// ---------------------------------------------------------------------------

export type ShoeCategoryGuide = {
  category: ShoeCategory;
  /** 카드에 크게 쓰는 이름 */
  title: string;
  /** "어떤 사람에게 맞는지" 한 줄 */
  forWhom: string;
  /** 업계 용어를 풀어 주는 한 줄. 용어가 없으면 빈 문자열 대신 성격 설명을 넣습니다. */
  termNote: string;
};

export const shoeCategoryGuides: readonly ShoeCategoryGuide[] = [
  {
    category: '데일리',
    title: '데일리 트레이너',
    forWhom: '매일 편하게 신을 한 켤레가 필요한 사람에게 맞아요.',
    termNote: '데일리 트레이너(평소 훈련에 두루 신는 기본 러닝화)',
  },
  {
    category: '슈퍼트레이너',
    title: '슈퍼 트레이너',
    forWhom: '꾸준히 뛰면서 조금 빠른 달리기도 하는 사람에게 맞아요.',
    termNote: shoeGlossary.슈퍼트레이너,
  },
  {
    category: '레이싱',
    title: '레이싱화',
    forWhom: '대회 당일 기록을 노리는 사람에게 맞아요.',
    termNote: '레이싱화(대회에서만 신는 가볍고 예민한 신발)',
  },
];

export function shoeCategoryGuide(category: ShoeCategory): ShoeCategoryGuide {
  const found = shoeCategoryGuides.find((guide) => guide.category === category);
  // shoeCategoryGuides는 shoeCategories를 전부 덮도록 테스트가 지키고 있습니다.
  if (!found) throw new Error(`알 수 없는 러닝화 갈래: ${category}`);
  return found;
}

// ---------------------------------------------------------------------------
// 2단계 · 세부 갈래
// ---------------------------------------------------------------------------

export type ShoeSubCategoryGuide = {
  category: ShoeCategory;
  subCategory: ShoeSubCategory;
  /** 카드에 쓰는 이름. taxonomy 값과 다르면 더 쉬운 말로 씁니다. */
  title: string;
  /** "어떤 사람에게 맞는지" 한 줄 */
  forWhom: string;
};

export const shoeSubCategoryGuides: readonly ShoeSubCategoryGuide[] = [
  {
    category: '데일리',
    subCategory: '입문화',
    title: '입문화',
    forWhom: '러닝화를 처음 사는 사람에게 무난한 기본형이에요.',
  },
  {
    category: '데일리',
    subCategory: '맥스 쿠션화',
    title: '맥스 쿠션화',
    forWhom: '바닥이 두툼해 착지 충격을 많이 덜어 주길 바라는 사람에게 맞아요.',
  },
  {
    category: '데일리',
    subCategory: '안정화',
    title: '안정화',
    forWhom: '달릴 때 발이 안쪽으로 무너지는 느낌이 있는 사람에게 맞아요.',
  },
  {
    category: '데일리',
    subCategory: '올라운더',
    title: '올라운더',
    forWhom: '한 켤레로 조깅부터 조금 빠른 달리기까지 다 하고 싶은 사람에게 맞아요.',
  },
  {
    category: '데일리',
    subCategory: '경량 트레이너',
    title: '경량 트레이너',
    forWhom: '가벼워서 발이 빨리 굴러가는 느낌을 좋아하는 사람에게 맞아요.',
  },
  {
    category: '슈퍼트레이너',
    subCategory: '논 플레이트',
    title: '판 없는 슈퍼 트레이너',
    forWhom: `${shoeGlossary.플레이트} 없이 폼만으로 튕겨 주는 편이라 부담이 가장 적어요.`,
  },
  {
    category: '슈퍼트레이너',
    subCategory: '라이트 플레이트',
    title: '부드러운 판',
    forWhom: `부드러운 ${shoeGlossary.플레이트}를 넣어 반발을 조금 더한 신발이에요.`,
  },
  {
    category: '슈퍼트레이너',
    subCategory: '카본 플레이트',
    title: '카본 판',
    forWhom: `${shoeGlossary.카본플레이트}를 넣어 튕기는 힘이 가장 큰 훈련화예요.`,
  },
  {
    category: '레이싱',
    subCategory: '중거리',
    title: '중거리 레이싱',
    forWhom: '5km~10km처럼 짧고 빠른 대회를 준비하는 사람에게 맞아요.',
  },
  {
    category: '레이싱',
    subCategory: '장거리',
    title: '장거리 레이싱',
    forWhom: '하프·풀코스처럼 오래 달리는 대회를 준비하는 사람에게 맞아요.',
  },
];

export function shoeSubCategoryGuidesOf(category: ShoeCategory): ShoeSubCategoryGuide[] {
  // taxonomy의 허용 순서를 그대로 따릅니다(화면 순서를 여기서 새로 만들지 않습니다).
  return shoeSubCategories[category].map((subCategory) => {
    const found = shoeSubCategoryGuides.find(
      (guide) => guide.category === category && guide.subCategory === subCategory,
    );
    if (!found) throw new Error(`세부 갈래 설명이 없습니다: ${category} > ${subCategory}`);
    return found;
  });
}

// ---------------------------------------------------------------------------
// 거리별 진입 · "얼마나 뛰세요?"
// ---------------------------------------------------------------------------

export type ShoeDistanceKey = '5km이하' | '10km' | '하프' | '풀' | '매일조깅';

export type ShoeDistanceEntry = {
  key: ShoeDistanceKey;
  /** 버튼에 쓰는 짧은 라벨 */
  label: string;
  /** "이 거리엔 이런 신발이 좋아요" 한 줄 */
  lead: string;
  /** taxonomy의 거리값으로의 대응. 여기 없는 값은 만들지 않습니다. */
  distances: ShoeDistance[];
};

export const shoeDistanceEntries: readonly ShoeDistanceEntry[] = [
  {
    key: '5km이하',
    label: '5km 이하',
    lead: '짧게 자주 뛰는 거리예요. 너무 두툼하지 않고 발이 가볍게 굴러가는 신발이 편해요.',
    distances: ['단거리', '5K'],
  },
  {
    key: '10km',
    label: '10km',
    lead: '가장 흔한 일상 거리예요. 쿠션과 가벼움이 균형 잡힌 신발이 두루 잘 맞아요.',
    distances: ['10K'],
  },
  {
    key: '하프',
    label: '하프(21km)',
    lead: '한두 시간 달리는 거리예요. 후반까지 발을 받쳐 주는 쿠션이 있는 신발이 좋아요.',
    distances: ['하프'],
  },
  {
    key: '풀',
    label: '풀코스(42km)',
    lead: '가장 긴 대회 거리예요. 오래 신어도 발이 덜 지치는 신발을 고르는 게 좋아요.',
    distances: ['풀'],
  },
  {
    key: '매일조깅',
    label: '매일 조깅',
    lead: '기록보다 꾸준함이 목적이에요. 편안함과 오래 쓰는 내구성을 먼저 보면 좋아요.',
    distances: ['장거리조깅'],
  },
];

export function shoeDistanceEntry(key: ShoeDistanceKey): ShoeDistanceEntry {
  const found = shoeDistanceEntries.find((entry) => entry.key === key);
  if (!found) throw new Error(`알 수 없는 거리 진입: ${key}`);
  return found;
}

// ---------------------------------------------------------------------------
// 실력별 진입
// "상급"처럼 부담스러운 말을 그대로 쓰지 않고, 지금 상태를 묻는 말로 바꿉니다.
// 내부 값(ShoeLevel)은 그대로 두어 카탈로그·필터와 어긋나지 않게 합니다.
// ---------------------------------------------------------------------------

export type ShoeLevelEntry = {
  level: ShoeLevel;
  /** 화면에 보이는 라벨 */
  label: string;
  /** 고르기 쉬우라고 붙이는 한 줄 */
  lead: string;
};

export const shoeLevelEntries: readonly ShoeLevelEntry[] = [
  {
    level: '입문',
    label: '이제 시작해요',
    lead: '아직 달리는 습관을 만드는 중이에요. 편안함과 안정감을 먼저 보는 게 좋아요.',
  },
  {
    level: '중급',
    label: '꾸준히 뛰어요',
    lead: '주 2~3회 이상 달리고 있어요. 쓰임에 따라 두 켤레로 나눠 신어도 좋아요.',
  },
  {
    level: '상급',
    label: '기록을 노려요',
    lead: '훈련을 나눠서 하고 대회 기록을 챙겨요. 훈련용과 대회용을 구분해서 보세요.',
  },
];

export function shoeLevelEntry(level: ShoeLevel): ShoeLevelEntry {
  const found = shoeLevelEntries.find((entry) => entry.level === level);
  if (!found) throw new Error(`알 수 없는 실력 진입: ${level}`);
  return found;
}

// ---------------------------------------------------------------------------
// 개수는 언제나 카탈로그에서 실측합니다. 화면에 숫자를 하드코딩하지 않습니다.
// ---------------------------------------------------------------------------

/**
 * 탐색 첫 화면은 갈래 3개·세부 갈래 10개·거리 5개·실력 3개, 모두 21개의 개수를 함께 보여 줍니다.
 * 예전에는 화면을 그릴 때마다 그 21개를 각각 목록 전체를 훑어 세었습니다(123종 × 21번).
 * 목록을 한 번만 훑어도 21개를 전부 낼 수 있으므로, 목록별로 딱 한 번 세어 두고 다시 씁니다.
 * 세는 규칙도 결과도 예전과 완전히 같습니다.
 */
type ShoeCountIndex = {
  byCategory: Map<string, number>;
  bySubCategory: Map<string, number>;
  byDistanceKey: Map<string, number>;
  byLevel: Map<string, number>;
};

const countIndexCache = new WeakMap<readonly ShoeEntry[], ShoeCountIndex>();

function buildCountIndex(values: ShoeEntry[]): ShoeCountIndex {
  const byCategory = new Map<string, number>();
  const bySubCategory = new Map<string, number>();
  const byDistanceKey = new Map<string, number>();
  const byLevel = new Map<string, number>();
  // 거리 진입(5km 이하·10km …)마다 어떤 taxonomy 거리값을 묶어 보는지 미리 펴 둡니다.
  const distanceGroups = shoeDistanceEntries.map((entry) => ({
    key: entry.key as string,
    wanted: new Set<string>(entry.distances),
  }));

  for (const entry of values) {
    byCategory.set(entry.category, (byCategory.get(entry.category) ?? 0) + 1);
    const subKey = `${entry.category}|${entry.subCategory}`;
    bySubCategory.set(subKey, (bySubCategory.get(subKey) ?? 0) + 1);
    // 같은 실력·거리가 한 항목에 두 번 적혀 있어도 한 번만 셉니다(예전 filter와 같은 결과).
    for (const level of new Set(entry.levels)) byLevel.set(level, (byLevel.get(level) ?? 0) + 1);
    for (const group of distanceGroups) {
      if (entry.distances.some((distance) => group.wanted.has(distance))) {
        byDistanceKey.set(group.key, (byDistanceKey.get(group.key) ?? 0) + 1);
      }
    }
  }
  return { byCategory, bySubCategory, byDistanceKey, byLevel };
}

function countIndex(values: ShoeEntry[]): ShoeCountIndex {
  const cached = countIndexCache.get(values);
  if (cached) return cached;
  const built = buildCountIndex(values);
  countIndexCache.set(values, built);
  return built;
}

export function countCategoryShoes(
  category: ShoeCategory,
  values: ShoeEntry[] = shoeCatalog,
): number {
  return countIndex(values).byCategory.get(category) ?? 0;
}

export function countSubCategoryShoes(
  category: ShoeCategory,
  subCategory: ShoeSubCategory,
  values: ShoeEntry[] = shoeCatalog,
): number {
  return countIndex(values).bySubCategory.get(`${category}|${subCategory}`) ?? 0;
}

export function countDistanceShoes(
  key: ShoeDistanceKey,
  values: ShoeEntry[] = shoeCatalog,
): number {
  // 모르는 진입 값이면 예전처럼 이 자리에서 곧바로 오류를 냅니다.
  shoeDistanceEntry(key);
  return countIndex(values).byDistanceKey.get(key) ?? 0;
}

export function countLevelShoes(level: ShoeLevel, values: ShoeEntry[] = shoeCatalog): number {
  return countIndex(values).byLevel.get(level) ?? 0;
}

// ---------------------------------------------------------------------------
// 화면 단계(뷰) 정의
// 큰 갈래 → 세부 갈래 → 목록의 3단계. 각 단계에서 한 칸씩 뒤로 갈 수 있습니다.
// ---------------------------------------------------------------------------

export type ShoeListSource =
  | { type: 'sub'; category: ShoeCategory; subCategory: ShoeSubCategory }
  | { type: 'category'; category: ShoeCategory }
  | { type: 'distance'; key: ShoeDistanceKey }
  | { type: 'level'; level: ShoeLevel }
  | { type: 'all' };

export type ShoeBrowseView =
  | { kind: 'home' }
  | { kind: 'category'; category: ShoeCategory }
  | { kind: 'list'; source: ShoeListSource };

export const shoeBrowseHome: ShoeBrowseView = { kind: 'home' };

/** 목록 화면의 제목입니다. */
export function shoeListTitle(source: ShoeListSource): string {
  if (source.type === 'all') return '러닝화 전체 보기';
  if (source.type === 'category') return `${shoeCategoryGuide(source.category).title} 전체`;
  if (source.type === 'sub') {
    const guide = shoeSubCategoryGuidesOf(source.category).find(
      (item) => item.subCategory === source.subCategory,
    );
    return guide ? guide.title : source.subCategory;
  }
  if (source.type === 'distance') return `${shoeDistanceEntry(source.key).label} 러닝화`;
  return `${shoeLevelEntry(source.level).label}`;
}

/** 목록 화면 맨 위의 한 줄 안내입니다. */
export function shoeListLead(source: ShoeListSource): string {
  if (source.type === 'all') {
    return '검색과 상세 필터는 여기에 모아 두었어요. 좁혀서 보고 싶으면 뒤로 가서 갈래부터 골라 보세요.';
  }
  if (source.type === 'category') return shoeCategoryGuide(source.category).forWhom;
  if (source.type === 'sub') {
    const guide = shoeSubCategoryGuidesOf(source.category).find(
      (item) => item.subCategory === source.subCategory,
    );
    return guide ? guide.forWhom : shoeCategoryGuide(source.category).forWhom;
  }
  if (source.type === 'distance') return shoeDistanceEntry(source.key).lead;
  return shoeLevelEntry(source.level).lead;
}

/** 목록에서 검색·상세 필터를 열어 주는 자리인지. "전체 보기"에서만 엽니다. */
export function allowsFullFilters(source: ShoeListSource): boolean {
  return source.type === 'all';
}

/** 진입 조건을 필터 상태로 바꿉니다. 정렬은 넘겨받은 값을 유지합니다. */
export function filtersForSource(
  source: ShoeListSource,
  sort: ShoeSort = emptyShoeFilterState.sort,
): ShoeFilterState {
  const base: ShoeFilterState = { ...emptyShoeFilterState, sort };
  if (source.type === 'all') return base;
  if (source.type === 'category') return { ...base, category: source.category };
  if (source.type === 'sub') {
    return { ...base, category: source.category, subCategories: [source.subCategory] };
  }
  if (source.type === 'distance') {
    return { ...base, distances: [...shoeDistanceEntry(source.key).distances] };
  }
  return { ...base, levels: [source.level] };
}

/** 뒤로 가기 한 칸. 목록에서 세부 갈래로, 세부 갈래에서 첫 화면으로 돌아갑니다. */
export function shoeBrowseBack(view: ShoeBrowseView): ShoeBrowseView {
  if (view.kind === 'home') return shoeBrowseHome;
  if (view.kind === 'category') return shoeBrowseHome;
  if (view.source.type === 'sub' || view.source.type === 'category') {
    return { kind: 'category', category: view.source.category };
  }
  return shoeBrowseHome;
}

/** 뒤로 가기 버튼에 쓸 라벨입니다. 어디로 가는지 말로 알려 줍니다. */
export function shoeBrowseBackLabel(view: ShoeBrowseView): string {
  const target = shoeBrowseBack(view);
  if (target.kind === 'category') return `${shoeCategoryGuide(target.category).title}로`;
  return '처음으로';
}

/**
 * 부모(라우터)가 딥링크 한 조각으로 화면 단계를 지정할 수 있게 합니다.
 * 모르는 값은 조용히 첫 화면으로 떨어집니다.
 */
export function shoeRouteToView(route?: string): ShoeBrowseView {
  if (!route) return shoeBrowseHome;
  if (route === 'all' || route === '전체') return { kind: 'list', source: { type: 'all' } };
  const category = shoeCategories.find((value) => value === route);
  if (category) return { kind: 'category', category };
  const distance = shoeDistanceEntries.find((entry) => entry.key === route);
  if (distance) return { kind: 'list', source: { type: 'distance', key: distance.key } };
  const level = shoeLevels.find((value) => value === route);
  if (level) return { kind: 'list', source: { type: 'level', level } };
  return shoeBrowseHome;
}
