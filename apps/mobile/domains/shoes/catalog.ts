// 공식 브랜드 페이지에서 확인한 사실과 러닝봄의 편집 설명을 분리한 러닝화 정본입니다.
//
// 데이터 출처 · 갱신 주기
// - 분류(카테고리/세부/플레이트/실력/거리)는 2026-05 기준 러닝화 분류 차트를 옮긴 편집 데이터입니다.
//   각 항목의 verification 필드로 'chart-2026-05'(차트 기반) / 'official-checked'(공식 페이지 확인)를 구분합니다.
// - 무게·드롭·스택높이·정확한 원화가는 제조사 공표값을 그 세대까지 확실히 아는 모델만 채웁니다
//   (weightGrams·dropMm·stackMm·priceKrw). 미확인이면 필드 자체를 만들지 않고 specNote로
//   "공식 스펙 미확인"을 정직하게 표기합니다. 출시일은 다루지 않고, priceBand는 밴드 구간만 나타냅니다.
// - 추정·환산·"대체로 이럴 것"으로 채우지 않습니다. 확신이 없으면 비우는 쪽이 항상 정답입니다.
// - 갱신 주기: 분기 1회 정기 점검 + 신제품 발표 시 수시. 갱신 시 SHOE_DATA_VERSION을 올립니다.
// - 정적 데이터 sidecar가 배포되면 domains/shoes/refresh.ts의 mergeShoeCatalog로 병합합니다.
export const SHOE_DATA_VERSION = '2026.07.26-v4';

import {
  shoeBrandColors,
  shoeSubCategories,
  type ShoeBrand,
  type ShoeCategory,
  type ShoeDistance,
  type ShoeLevel,
  type ShoePlate,
  type ShoePriceBand,
  type ShoePurposeTag,
  type ShoeSubCategory,
  type ShoeVerification,
} from './taxonomy';

export type ShoeSurface = 'road' | 'treadmill' | 'mixed';
export type ShoePriority = 'comfort' | 'balanced' | 'speed';
export type ShoeStatus = 'available' | 'upcoming' | 'global-only';
export type ShoeCollection = '전체' | '데일리' | '쿠션' | '국내 공식 확인' | '출시 예정';

export type Shoe = {
  id: string;
  brand: string;
  model: string;
  status: ShoeStatus;
  surfaces: ShoeSurface[];
  priorities: ShoePriority[];
  distanceKm: 'short' | 'daily' | 'long';
  officialFacts: string[];
  editorialSummary: string;
  consideration: string;
  officialUrl: string;
  verifiedAt: string;
  priceKrw: number | null;
  koreaStatus: string;
};

export const shoes: Shoe[] = [
  {
    id: 'nike-pegasus-42',
    brand: 'Nike',
    model: 'Pegasus 42',
    status: 'available',
    surfaces: ['road', 'treadmill'],
    priorities: ['balanced'],
    distanceKm: 'daily',
    officialFacts: ['일상 러닝용 로드 러닝화', 'ReactX 폼과 Air Zoom 유닛'],
    editorialSummary: '속도와 편안함 사이에서 무난한 데일리 선택이에요.',
    consideration: '아주 푹신한 착화감을 우선한다면 쿠션 중심 모델도 비교해 보세요.',
    officialUrl: 'https://www.nike.com/kr/t/페가수스-42-남성-로드-러닝화-Hq1m5r/FD2722-001',
    verifiedAt: '2026-07-26',
    priceKrw: null,
    koreaStatus: '국내 공식 페이지 확인',
  },
  {
    id: 'adidas-supernova-rise-2',
    brand: 'adidas',
    model: 'Supernova Rise 2',
    status: 'available',
    surfaces: ['road', 'treadmill'],
    priorities: ['comfort', 'balanced'],
    distanceKm: 'daily',
    officialFacts: ['Dreamstrike+ 미드솔', '서포트 로드 시스템', '남성 265mm 기준 275g'],
    editorialSummary: '편안한 일상 러닝을 우선할 때 살펴보기 좋아요.',
    consideration: '빠른 훈련 전용 신발을 찾는다면 속도 중심 모델과 함께 비교하세요.',
    officialUrl:
      'https://www.adidas.co.kr/%EC%8A%88%ED%8D%BC%EB%85%B8%EB%B0%94-%EB%9D%BC%EC%9D%B4%EC%A6%88-2/IH2504.html',
    verifiedAt: '2026-07-26',
    priceKrw: null,
    koreaStatus: '국내 공식 페이지 확인',
  },
  {
    id: 'asics-gel-nimbus-27',
    brand: 'ASICS',
    model: 'GEL-NIMBUS 27',
    status: 'global-only',
    surfaces: ['road', 'treadmill'],
    priorities: ['comfort'],
    distanceKm: 'long',
    officialFacts: ['PureGEL 기술', 'FF BLAST PLUS ECO 쿠셔닝', 'HYBRID ASICSGRIP 아웃솔'],
    editorialSummary: '부드러운 착지와 장거리 편안함을 중시할 때 비교하기 좋아요.',
    consideration: '가볍고 빠른 느낌을 최우선으로 한다면 무게와 반응성을 함께 확인하세요.',
    officialUrl: 'https://www.asics.com/jp/ja-jp/mk/running/nimbus',
    verifiedAt: '2026-07-26',
    priceKrw: null,
    koreaStatus: '글로벌 공식 정보 확인 · 국내 일정 미확인',
  },
  {
    id: 'new-balance-1080-v14',
    brand: 'New Balance',
    model: 'Fresh Foam X 1080v14',
    status: 'global-only',
    surfaces: ['road', 'treadmill'],
    priorities: ['comfort', 'balanced'],
    distanceKm: 'long',
    officialFacts: ['Fresh Foam X 미드솔', '6mm 드롭', '남성 기준 298g'],
    editorialSummary: '일상부터 긴 거리까지 편안함을 넓게 쓰고 싶을 때 살펴보기 좋아요.',
    consideration: '발에 맞는 폭과 사이즈는 공식 사이즈 안내에서 다시 확인하세요.',
    officialUrl:
      'https://www.newbalance.com/pd/fresh-foam-x-1080v14/M1080V14-47512-PMG-NA-E.html',
    verifiedAt: '2026-07-26',
    priceKrw: null,
    koreaStatus: '글로벌 공식 정보 확인 · 국내 일정 미확인',
  },
  {
    id: 'hoka-clifton-10',
    brand: 'HOKA',
    model: 'Clifton 10',
    status: 'global-only',
    surfaces: ['road', 'treadmill'],
    priorities: ['comfort'],
    distanceKm: 'daily',
    officialFacts: ['데일리 로드 러닝 제품군', '공식 Clifton 10 제품 페이지 확인'],
    editorialSummary: '부드러운 데일리 러닝화를 비교할 때 함께 보기 좋아요.',
    consideration: '국내 판매 상태와 정확한 사양은 구매 전 국내 공식 채널에서 확인하세요.',
    officialUrl:
      'https://vn.hoka.com/en/products/giay-chay-bo-nam-hoka-clifton-10-1162030-prsm-persimmon',
    verifiedAt: '2026-07-26',
    priceKrw: null,
    koreaStatus: '글로벌 공식 정보 확인 · 국내 일정 미확인',
  },
  {
    id: 'mizuno-wave-rider-29',
    brand: 'Mizuno',
    model: 'Wave Rider 29',
    status: 'global-only',
    surfaces: ['road', 'treadmill'],
    priorities: ['balanced'],
    distanceKm: 'daily',
    officialFacts: ['공식 Wave Rider 29 발표 자료 확인', '데일리 러닝 제품군'],
    editorialSummary: '안정적인 일상 훈련화를 넓게 비교할 때 살펴보기 좋아요.',
    consideration: '국내 출시 여부와 세부 사양은 공식 판매 페이지에서 다시 확인하세요.',
    officialUrl:
      'https://corp.mizuno.com/en/articles/0067',
    verifiedAt: '2026-07-26',
    priceKrw: null,
    koreaStatus: '글로벌 공식 정보 확인 · 국내 일정 미확인',
  },
  {
    id: 'saucony-ride-18',
    brand: 'Saucony',
    model: 'Ride 18',
    status: 'global-only',
    surfaces: ['road', 'treadmill'],
    priorities: ['balanced'],
    distanceKm: 'daily',
    officialFacts: ['PWRRUN+ 미드솔', '8mm 오프셋', '남성 기준 259g'],
    editorialSummary: '부드러움과 반응성을 함께 보려는 일상 러너에게 맞는 비교 후보예요.',
    consideration: '국내 판매 여부와 가격은 공식 국내 채널에서 별도로 확인하세요.',
    officialUrl: 'https://www.saucony.com/UK/en_GB/ride-18/59943M.html',
    verifiedAt: '2026-07-26',
    priceKrw: null,
    koreaStatus: '글로벌 공식 정보 확인 · 국내 일정 미확인',
  },
  {
    id: 'brooks-ghost-17',
    brand: 'Brooks',
    model: 'Ghost 17',
    status: 'global-only',
    surfaces: ['road', 'treadmill'],
    priorities: ['comfort', 'balanced'],
    distanceKm: 'daily',
    officialFacts: ['10mm 미드솔 드롭', '남성 기준 286.3g', 'DNA LOFT v3 쿠셔닝'],
    editorialSummary: '편안한 일상 러닝과 걷기를 함께 고려할 때 비교하기 좋아요.',
    consideration: '국내 판매 상태와 폭 선택은 구매 전 공식 채널에서 확인하세요.',
    officialUrl:
      'https://www.brooksrunning.com/en_gb/mens/road-running-shoes/ghost-17/1104421D112.150.html',
    verifiedAt: '2026-07-26',
    priceKrw: null,
    koreaStatus: '글로벌 공식 정보 확인 · 국내 일정 미확인',
  },
];

export const shoeCollections: ShoeCollection[] = ['전체', '데일리', '쿠션', '국내 공식 확인', '출시 예정'];

export function matchesShoeCollection(shoe: Shoe, collection: ShoeCollection): boolean {
  if (collection === '전체') return true;
  if (collection === '출시 예정') return shoe.status === 'upcoming';
  if (collection === '국내 공식 확인') return shoe.status === 'available' || shoe.id === 'asics-gel-nimbus-27' || shoe.id === 'new-balance-1080-v14';
  if (collection === '쿠션') return shoe.priorities.includes('comfort');
  return shoe.distanceKm === 'daily';
}

export type ShoeFinderAnswers = {
  surface: ShoeSurface;
  distance: Shoe['distanceKm'];
  priority: ShoePriority;
  budget: 'under-150' | 'under-200' | 'open';
};

function budgetLimitKrw(budget: ShoeFinderAnswers['budget']): number | undefined {
  if (budget === 'under-150') return 150_000;
  if (budget === 'under-200') return 200_000;
  return undefined;
}

export function recommendShoes(
  answers: ShoeFinderAnswers,
  values: Shoe[] = shoes,
): Shoe[] {
  const limit = budgetLimitKrw(answers.budget);
  return [...values]
    .map((shoe) => ({
      shoe,
      score:
        Number(shoe.surfaces.includes(answers.surface)) * 3 +
        Number(shoe.distanceKm === answers.distance) * 2 +
        Number(shoe.priorities.includes(answers.priority)) * 3 +
        (limit === undefined || shoe.priceKrw === null
          ? 0
          : shoe.priceKrw <= limit
            ? 2
            : -5),
    }))
    .sort((left, right) => right.score - left.score || left.shoe.model.localeCompare(right.shoe.model))
    .map(({ shoe }) => shoe)
    .slice(0, 3);
}

export const shoeFinderInternals = { budgetLimitKrw };

// ---------------------------------------------------------------------------
// 확장 카탈로그 (v2)
// 위 legacy `shoes` 배열은 공식 페이지 확인 기록을 위해 그대로 두고,
// 아래 `shoeCatalog`가 전체 탐색 화면이 사용하는 정본입니다.
// ---------------------------------------------------------------------------

export type ShoeEntry = {
  id: string;
  brand: ShoeBrand;
  /** 한글 표기 모델명 */
  model: string;
  /** 영문 표기 모델명 (검색·구매 링크 질의에 사용) */
  modelEn: string;
  category: ShoeCategory;
  subCategory: ShoeSubCategory;
  plate: ShoePlate;
  levels: ShoeLevel[];
  distances: ShoeDistance[];
  /** 모든 항목이 가지는 가격 구간입니다. 정확한 정가는 priceKrw가 확인된 모델에만 붙습니다. */
  priceBand: ShoePriceBand;
  purposeTags: ShoePurposeTag[];
  strengths: string[];
  watchouts: string[];
  /** 한 줄 추천 이유 */
  pick: string;
  brandColor: string;
  verification: ShoeVerification;
  /** 무게·드롭·스택 등 수치 스펙의 확인 상태를 정직하게 남기는 자리 */
  specNote?: string;
  // -------------------------------------------------------------------------
  // 공식 스펙(선택 필드)
  //
  // 정책: "정확한 수치는 넣지 않는다"를 완화하되 뒤집지는 않습니다.
  // - 제조사가 공표한 값을 그 세대(버전)까지 확실히 아는 모델만 채웁니다.
  // - 조금이라도 확신이 없으면 필드를 비웁니다. 추정·환산·반올림으로 채우지 않습니다.
  // - 비어 있으면 화면은 값을 지어내지 않고 "공식 페이지에서 확인" 안내로 대체합니다.
  // -------------------------------------------------------------------------
  /** 제조사 공표 무게(g). 브랜드 표준 남성 사이즈(US 9) 기준 값만 넣습니다. */
  weightGrams?: number;
  /** 제조사 공표 힐-토 드롭(mm) */
  dropMm?: number;
  /** 제조사 공표 스택 높이(mm). heel/forefoot 두 값이 모두 확인될 때만 넣습니다. */
  stackMm?: { heel: number; forefoot: number };
  /** 국내 정가(원). 국내 공식 판매가가 확실할 때만 넣고, 아니면 priceBand만 씁니다. */
  priceKrw?: number;
  /** 언제 신는 신발인지 2~3문장으로 설명합니다. 세부 카테고리 기준에 항목별 거리·실력을 붙여 만듭니다. */
  useCase: string;
  /** 착화감·발볼·사이즈 경향. 단정하지 않고 "알려져 있어요 · 매장 착화 권장" 톤을 유지합니다. */
  fitNote: string;
  /** 같은 세부 카테고리 안의 대표 대안 1~2종(카탈로그 id). 화면의 "비슷한 신발 비교"에 씁니다. */
  comparedTo: string[];
  /** 어떤 러너에게 맞는지. 의료적 단정 대신 러닝 상황으로만 표현합니다. */
  bestForRunner: string[];
  /** 이 신발이 잘 맞지 않는 경우 */
  notFor: string[];
  /** 브랜드가 공식적으로 쓰는 폼·플레이트 기술명만. 확인되지 않으면 빈 배열입니다. */
  keyTech: string[];
};

type SubCategoryDefault = {
  plate: ShoePlate;
  levels: ShoeLevel[];
  distances: ShoeDistance[];
  purposeTags: ShoePurposeTag[];
  priceBand: ShoePriceBand;
};

const subCategoryDefaults: Record<ShoeSubCategory, SubCategoryDefault> = {
  입문화: {
    plate: 'none',
    levels: ['입문', '중급'],
    distances: ['5K', '10K', '장거리조깅'],
    purposeTags: ['데일리조깅', '회복주'],
    priceBand: '미들',
  },
  '맥스 쿠션화': {
    plate: 'none',
    levels: ['입문', '중급'],
    distances: ['10K', '하프', '장거리조깅'],
    purposeTags: ['데일리조깅', '장거리', '회복주'],
    priceBand: '하이',
  },
  안정화: {
    plate: 'none',
    levels: ['입문', '중급'],
    distances: ['5K', '10K', '장거리조깅'],
    purposeTags: ['데일리조깅', '안정지지', '회복주'],
    priceBand: '미들',
  },
  올라운더: {
    plate: 'none',
    levels: ['입문', '중급', '상급'],
    distances: ['5K', '10K', '하프', '장거리조깅'],
    purposeTags: ['데일리조깅', '스피드훈련'],
    priceBand: '미들',
  },
  '경량 트레이너': {
    plate: 'none',
    levels: ['중급', '상급'],
    distances: ['단거리', '5K', '10K'],
    purposeTags: ['스피드훈련', '데일리조깅'],
    priceBand: '엔트리',
  },
  '논 플레이트': {
    plate: 'none',
    levels: ['중급', '상급'],
    distances: ['10K', '하프', '장거리조깅'],
    purposeTags: ['스피드훈련', '장거리', '데일리조깅'],
    priceBand: '하이',
  },
  '라이트 플레이트': {
    plate: 'light',
    levels: ['중급', '상급'],
    distances: ['10K', '하프', '풀'],
    purposeTags: ['스피드훈련', '대회레이스'],
    priceBand: '하이',
  },
  '카본 플레이트': {
    plate: 'carbon',
    levels: ['중급', '상급'],
    distances: ['10K', '하프', '풀'],
    purposeTags: ['스피드훈련', '대회레이스'],
    priceBand: '하이',
  },
  중거리: {
    plate: 'carbon',
    levels: ['상급'],
    distances: ['단거리', '5K', '10K'],
    purposeTags: ['대회레이스', '스피드훈련'],
    priceBand: '프리미엄',
  },
  장거리: {
    plate: 'carbon',
    levels: ['중급', '상급'],
    distances: ['하프', '풀'],
    purposeTags: ['대회레이스'],
    priceBand: '프리미엄',
  },
};

// ---------------------------------------------------------------------------
// 구매 결정용 심화 설명 (useCase / bestForRunner / notFor / fitNote / keyTech)
//
// 정직성 원칙
// - 여기 있는 문장은 "세부 카테고리의 용도"를 옮긴 편집 설명이지, 개별 제품의 측정값이 아닙니다.
// - 무게·드롭·스택·가격 같은 수치는 여전히 넣지 않습니다(priceBand만 씁니다).
// - fitNote는 브랜드별로 널리 알려진 경향만 완충 표현으로 적고, 항상 매장 착화를 권합니다.
// - keyTech는 브랜드 공식 명칭이 확실한 경우에만 채우고 나머지는 빈 배열로 둡니다.
// ---------------------------------------------------------------------------

type SubCategoryGuide = {
  /** useCase 첫 문장 */
  useCase: string;
  bestForRunner: string[];
  notFor: string[];
};

const subCategoryGuides: Record<ShoeSubCategory, SubCategoryGuide> = {
  입문화: {
    useCase: '주 3~4회 편안한 조깅과 회복주, 10km 안쪽 일상 러닝에 두루 쓰는 자리예요.',
    bestForRunner: [
      '러닝을 막 시작해 한 켤레로 다 해결하고 싶은 러너',
      '무리 없이 편한 페이스로 꾸준히 달리려는 러너',
    ],
    notFor: ['대회 기록 단축이 지금 목표인 경우', '반발력 큰 플레이트 감각을 기대하는 경우'],
  },
  '맥스 쿠션화': {
    useCase: '두툼한 쿠션으로 착지 충격을 덜어 주는 자리예요. 장거리 조깅과 훈련 다음 날 회복주에 잘 맞습니다.',
    bestForRunner: [
      '오래 달릴 때 다리 피로가 먼저 오는 러너',
      '체중 부담이 있어 푹신한 착지를 원하는 러너',
      '주간 마일리지가 높아 회복용 한 켤레가 필요한 러너',
    ],
    notFor: ['가볍고 날렵한 반응성을 우선하는 경우', '빠른 템포·인터벌 전용 신발을 찾는 경우'],
  },
  안정화: {
    useCase: '미드솔 안쪽을 단단하게 잡아 주는 지지 구조가 들어간 자리예요. 발이 안쪽으로 무너지는 느낌이 신경 쓰일 때 데일리 조깅용으로 봅니다.',
    bestForRunner: [
      '달릴 때 발이 안쪽으로 기우는 느낌이 있는 러너',
      '긴 조깅 후반에 자세가 흐트러지는 게 고민인 러너',
    ],
    notFor: [
      '이미 중립형 신발이 잘 맞는 경우',
      '가벼운 무게가 최우선인 경우',
      '통증·부상 대응이 필요한 경우(신발 대신 전문가 상담이 먼저예요)',
    ],
  },
  올라운더: {
    useCase: '조깅부터 가벼운 템포까지 한 켤레로 넓게 쓰는 자리예요. 훈련 종류가 자주 바뀌는 러너가 기본으로 두기 좋습니다.',
    bestForRunner: [
      '신발을 여러 켤레로 나누기 부담스러운 러너',
      '조깅과 스피드 훈련을 섞어 하는 러너',
    ],
    notFor: ['한 가지 용도에 극단적으로 특화된 신발을 원하는 경우'],
  },
  '경량 트레이너': {
    useCase: '가볍고 얇은 구성으로 발을 빠르게 굴리는 자리예요. 짧은 스피드 훈련이나 가벼운 템포 구간에 씁니다.',
    bestForRunner: [
      '가벼운 무게와 지면 감각을 좋아하는 러너',
      '스피드 훈련용 한 켤레를 따로 두려는 러너',
    ],
    notFor: ['매일 신는 유일한 신발로 쓰려는 경우', '푹신한 쿠션을 우선하는 경우'],
  },
  '논 플레이트': {
    useCase: '플레이트 없이 폼만으로 반발을 만드는 슈퍼트레이너 자리예요. 템포 주행과 긴 거리 훈련을 한 켤레로 소화할 때 봅니다.',
    bestForRunner: [
      '플레이트의 단단한 감각은 부담스럽지만 반발은 원하는 러너',
      '훈련 강도를 폭넓게 쓰는 중급 이상 러너',
    ],
    notFor: ['첫 러닝화를 고르는 경우', '가격대를 최대한 낮추려는 경우'],
  },
  '라이트 플레이트': {
    useCase: '가벼운 플레이트로 굴림을 돕는 훈련용 자리예요. 템포·인터벌 훈련과 대회 준비 주행에 씁니다.',
    bestForRunner: [
      '대회를 준비하며 훈련용 반발 신발이 필요한 러너',
      '카본화 전에 플레이트 감각을 익히려는 러너',
    ],
    notFor: ['천천히 오래 달리는 조깅이 주력인 경우', '입문 단계에서 첫 켤레를 찾는 경우'],
  },
  '카본 플레이트': {
    useCase: '카본 플레이트가 들어간 훈련·대회 겸용 자리예요. 빠른 페이스 구간에서 굴림을 크게 만들어 줍니다.',
    bestForRunner: [
      '레이스 페이스 훈련을 정기적으로 하는 러너',
      '대회용 신발의 감각을 훈련에서 미리 익히려는 러너',
    ],
    notFor: [
      '러닝을 시작한 지 얼마 되지 않은 경우',
      '회복주·조깅 위주로 달리는 경우',
      '발목·발바닥에 부담을 느끼는 시기(무리하지 말고 쉬운 신발부터 보세요)',
    ],
  },
  중거리: {
    useCase: '5km~10km처럼 짧고 빠른 레이스에 맞춘 대회화 자리예요. 가볍게 만드는 대신 쿠션과 내구성은 양보한 구성입니다.',
    bestForRunner: ['단거리~10km 대회 기록에 집중하는 러너', '트랙·로드 스피드 세션이 잦은 상급 러너'],
    notFor: ['일상 조깅용으로 쓰려는 경우', '풀코스 완주가 목표인 경우'],
  },
  장거리: {
    useCase: '하프·풀코스 레이스를 겨냥한 대회화 자리예요. 대회 당일과 레이스 페이스 훈련에서만 쓰는 것을 기본으로 봅니다.',
    bestForRunner: ['목표 대회를 앞두고 기록을 노리는 러너', '레이스 페이스가 이미 몸에 익은 러너'],
    notFor: [
      '매일 신는 데일리화가 필요한 경우',
      '러닝 경력이 짧아 아직 페이스가 잡히지 않은 경우',
      '내구성 대비 가격이 부담스러운 경우',
    ],
  },
};

/**
 * 브랜드별로 널리 알려진 착화감 경향만 완충 표현으로 남깁니다.
 * 어떤 문장도 특정 제품의 실측이 아니며, 마지막은 항상 매장 착화 권고로 끝냅니다.
 */
const FIT_TAIL = '발 모양에 따라 체감이 달라지니 매장 착화를 권해요.';

const brandFitNotes: Readonly<Record<ShoeBrand, string>> = {
  Nike: `일반적으로 발볼이 좁은 편으로 알려져 있어요. 발볼이 넓다면 반 사이즈 여유를 고려해 보세요. ${FIT_TAIL}`,
  adidas: `일반적으로 발등이 낮고 감싸는 핏으로 알려져 있어요. 두꺼운 양말을 쓴다면 여유를 고려해 보세요. ${FIT_TAIL}`,
  ASICS: `일반적으로 표준 발볼에 무난하게 맞는 편으로 알려져 있어요. 라인에 따라 폭 옵션이 있는 경우도 있습니다. ${FIT_TAIL}`,
  'New Balance': `일반적으로 폭 옵션(2E 등) 선택지가 넓은 브랜드로 알려져 있어요. 발볼이 넓다면 폭 옵션을 먼저 확인해 보세요. ${FIT_TAIL}`,
  Saucony: `일반적으로 앞볼에 여유가 있는 편으로 알려져 있어요. 발이 가늘다면 끈 조임으로 조절하는 경우가 많습니다. ${FIT_TAIL}`,
  PUMA: `일반적으로 발을 감싸는 슬림한 핏으로 알려져 있어요. 사이즈는 평소와 같게 보되 앞볼 여유를 확인해 보세요. ${FIT_TAIL}`,
  HOKA: `일반적으로 스택이 높고 감싸는 어퍼로 알려져 있어요. 라인에 따라 와이드 옵션이 나오는 경우도 있습니다. ${FIT_TAIL}`,
  Brooks: `일반적으로 표준~여유 있는 발볼로 알려져 있어요. 폭 옵션이 있는 라인이 많은 편입니다. ${FIT_TAIL}`,
  Mizuno: `일반적으로 발을 단단히 잡아 주는 핏으로 알려져 있어요. 발볼이 넓다면 여유를 확인해 보세요. ${FIT_TAIL}`,
  On: `일반적으로 길이가 짧게 나오는 편이라는 평이 있어요. 사이즈 선택 전에 길이를 함께 확인해 보세요. ${FIT_TAIL}`,
};

/**
 * 모델명 자체에 브랜드 공식 플랫폼명이 들어간 경우만 기계적으로 뽑습니다.
 * (예: "FuelCell Rebel v5" → FuelCell, "Velocity NITRO 4" → NITRO)
 * 추정으로 폼 이름을 붙이지 않기 위한 안전한 규칙입니다.
 */
const nameEmbeddedTech: readonly (readonly [RegExp, string])[] = [
  [/fresh foam x/i, 'Fresh Foam X 미드솔'],
  [/fuelcell/i, 'FuelCell 폼'],
  [/nitro/i, 'NITRO 폼'],
  [/supercomp/i, 'FuelCell SuperComp 구성'],
];

/**
 * 브랜드 공식 자료에서 확인된 폼·플레이트 명칭만 항목별로 적어 둡니다.
 * 확신이 없으면 넣지 않습니다(빈 배열이 정답입니다).
 */
const curatedKeyTech: Readonly<Record<string, readonly string[]>> = {
  'nike-pegasus-42': ['ReactX 폼', 'Air Zoom 유닛'],
  'nike-vaporfly-4': ['ZoomX 폼', '풀 렝스 카본 플레이트'],
  'nike-alphafly-3': ['ZoomX 폼', 'Air Zoom 유닛', '풀 렝스 카본 플레이트'],
  'nike-zoomfly-6': ['ZoomX 폼', '카본 플레이트'],
  'nike-streakfly-2': ['ZoomX 폼'],
  'nike-pegasus-plus': ['ZoomX 폼'],
  'adidas-supernova-rise-2': ['Dreamstrike+ 미드솔', '서포트 로드 시스템'],
  'adidas-supernova-rise-3': ['Dreamstrike+ 미드솔'],
  'adidas-adizero-adios-pro-4': ['Lightstrike Pro 폼', 'ENERGYRODS'],
  'adidas-adizero-pro-evo-3': ['Lightstrike Pro 폼', 'ENERGYRODS'],
  'adidas-adizero-boston-13': ['Lightstrike Pro 폼', 'ENERGYRODS'],
  'adidas-adizero-takumi-sen-11': ['Lightstrike Pro 폼', 'ENERGYRODS'],
  'adidas-evo-sl': ['Lightstrike Pro 폼'],
  'asics-gel-nimbus-27': ['PureGEL', 'FF BLAST PLUS ECO'],
  'new-balance-1080-v14': ['Fresh Foam X 미드솔'],
  'saucony-ride-18': ['PWRRUN+ 미드솔'],
};

function keyTechFor(id: string, modelEn: string): string[] {
  const curated = curatedKeyTech[id];
  if (curated) return [...curated];
  const derived = nameEmbeddedTech
    .filter(([pattern]) => pattern.test(modelEn))
    .map(([, label]) => label);
  return Array.from(new Set(derived));
}

function buildUseCase(guide: SubCategoryGuide, distances: ShoeDistance[], levels: ShoeLevel[]): string {
  return [
    guide.useCase,
    `어울리는 거리는 ${distances.join('·')} 정도로 봅니다.`,
    `${levels.join('·')} 러너가 주로 찾는 자리예요.`,
  ].join(' ');
}

const categoryOfSubCategory = new Map<ShoeSubCategory, ShoeCategory>(
  (Object.entries(shoeSubCategories) as [ShoeCategory, readonly ShoeSubCategory[]][]).flatMap(
    ([category, subs]) => subs.map((sub) => [sub, category] as const),
  ),
);

type ShoeEntryInput = {
  id: string;
  brand: ShoeBrand;
  model: string;
  modelEn: string;
  sub: ShoeSubCategory;
  plate?: ShoePlate;
  levels?: ShoeLevel[];
  distances?: ShoeDistance[];
  priceBand?: ShoePriceBand;
  purposeTags?: ShoePurposeTag[];
  strengths: string[];
  watchouts: string[];
  pick: string;
  verification?: ShoeVerification;
  specNote?: string;
  /** 공식 스펙. 확인된 모델만 넘기고 나머지는 넘기지 않습니다(추정 금지). */
  weightGrams?: number;
  dropMm?: number;
  stackMm?: { heel: number; forefoot: number };
  priceKrw?: number;
  /** 아래 심화 필드는 비워 두면 세부 카테고리·브랜드 기준값으로 채웁니다. */
  useCase?: string;
  fitNote?: string;
  bestForRunner?: string[];
  notFor?: string[];
  keyTech?: string[];
  comparedTo?: string[];
};

function define(input: ShoeEntryInput): ShoeEntry {
  const fallback = subCategoryDefaults[input.sub];
  const guide = subCategoryGuides[input.sub];
  const category = categoryOfSubCategory.get(input.sub);
  if (!category) throw new Error(`unknown sub category: ${input.sub}`);
  const levels = input.levels ?? [...fallback.levels];
  const distances = input.distances ?? [...fallback.distances];
  return {
    id: input.id,
    brand: input.brand,
    model: input.model,
    modelEn: input.modelEn,
    category,
    subCategory: input.sub,
    plate: input.plate ?? fallback.plate,
    levels,
    distances,
    priceBand: input.priceBand ?? fallback.priceBand,
    purposeTags: input.purposeTags ?? [...fallback.purposeTags],
    strengths: input.strengths,
    watchouts: input.watchouts,
    pick: input.pick,
    brandColor: shoeBrandColors[input.brand],
    verification: input.verification ?? 'chart-2026-05',
    ...(input.specNote ? { specNote: input.specNote } : {}),
    // 확인된 값만 실제 키로 존재하게 둡니다(undefined 키를 만들지 않습니다).
    ...(typeof input.weightGrams === 'number' ? { weightGrams: input.weightGrams } : {}),
    ...(typeof input.dropMm === 'number' ? { dropMm: input.dropMm } : {}),
    ...(input.stackMm ? { stackMm: { ...input.stackMm } } : {}),
    ...(typeof input.priceKrw === 'number' ? { priceKrw: input.priceKrw } : {}),
    useCase: input.useCase ?? buildUseCase(guide, distances, levels),
    fitNote: input.fitNote ?? brandFitNotes[input.brand],
    bestForRunner: input.bestForRunner ?? [...guide.bestForRunner],
    notFor: input.notFor ?? [...guide.notFor],
    keyTech: input.keyTech ?? keyTechFor(input.id, input.modelEn),
    comparedTo: input.comparedTo ? [...input.comparedTo] : [],
  };
}

const UNVERIFIED_SPEC = '무게·드롭·스택 등 공식 스펙 미확인';
const UNVERIFIED_PLATE = '플레이트 사양 공식 미확인 · 무게·드롭·스택 공식 스펙 미확인';
/** 드롭만 공표값을 확인한 모델에 붙입니다. */
const DROP_CONFIRMED = '드롭만 제조사 공표값 확인 · 무게·스택·정가 미확인';
/** 드롭과 스택을 함께 확인한 모델에 붙입니다. */
const DROP_STACK_CONFIRMED = '드롭·스택은 제조사 공표값 확인 · 무게·정가 미확인';
/** 무게와 드롭을 함께 확인한 모델에 붙입니다. */
const WEIGHT_DROP_CONFIRMED = '무게·드롭은 제조사 공표값 확인 · 스택·정가 미확인';

const dailyEntryShoes: ShoeEntry[] = [
  define({
    id: 'nike-pegasus-42',
    brand: 'Nike',
    model: '페가수스 42',
    modelEn: 'Pegasus 42',
    sub: '입문화',
    strengths: ['데일리 러닝의 기준점이 되는 무난한 균형', '조깅부터 가벼운 템포까지 한 켤레로 소화'],
    watchouts: ['아주 푹신한 착화감을 원하면 맥스 쿠션화를 함께 보세요'],
    pick: '무엇을 살지 모르겠다면 여기서 시작하는 게 가장 안전해요.',
    verification: 'official-checked',
    dropMm: 10,
    specNote: DROP_CONFIRMED,
  }),
  define({
    id: 'nike-pegasus-premium',
    brand: 'Nike',
    model: '페가수스 프리미엄',
    modelEn: 'Pegasus Premium',
    sub: '입문화',
    priceBand: '하이',
    strengths: ['페가수스 계열에서 쿠션감을 끌어올린 상위 구성', '데일리 주행에 반동감을 더한 성격'],
    watchouts: ['입문화 중에서는 가격대가 높은 편이에요'],
    pick: '페가수스 감성은 유지하면서 더 좋은 승차감을 원할 때예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'adidas-adistar-4',
    brand: 'adidas',
    model: '아디스타 4',
    modelEn: 'Adistar 4',
    sub: '입문화',
    distances: ['10K', '하프', '장거리조깅'],
    strengths: ['오래 신어도 버티는 내구 지향 구성', '느린 페이스의 긴 조깅에 잘 맞는 안정감'],
    watchouts: ['가볍고 빠른 느낌을 원하면 경량 트레이너가 낫습니다'],
    pick: '천천히 오래 달리는 러닝이 주력이면 좋은 선택이에요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'adidas-supernova-rise-3',
    brand: 'adidas',
    model: '슈퍼노바 라이즈 3',
    modelEn: 'Supernova Rise 3',
    sub: '입문화',
    strengths: ['부드러운 쿠션과 편안한 발볼감', '입문자가 부담 없이 매일 신기 좋은 성격'],
    watchouts: ['스피드 훈련용으로는 반응성이 아쉬울 수 있어요'],
    pick: '첫 러닝화로 편안함을 최우선으로 둔다면 여기예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'asics-gel-cumulus-28',
    brand: 'ASICS',
    model: '젤 큐뮬러스 28',
    modelEn: 'GEL-Cumulus 28',
    sub: '입문화',
    strengths: ['오래된 데일리 라인 특유의 안정된 착화감', '님버스보다 가볍고 실용적인 균형'],
    watchouts: ['최고 수준의 푹신함을 기대하면 아쉬울 수 있어요'],
    pick: '아식스 데일리를 합리적으로 시작하는 표준 코스예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'new-balance-880-v15',
    brand: 'New Balance',
    model: '880 V15',
    modelEn: 'Fresh Foam X 880v15',
    sub: '입문화',
    strengths: ['특별한 개성 없이 두루 잘 맞는 무난함', '폭 옵션 선택지가 넓은 편'],
    watchouts: ['개성 있는 반발감을 원하면 올라운더 쪽을 보세요'],
    pick: '발볼·폭 때문에 고민이 많았다면 먼저 신어볼 만해요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'new-balance-elipse-v1',
    brand: 'New Balance',
    model: '엘립스 V1',
    modelEn: 'Elipse v1',
    sub: '입문화',
    priceBand: '엔트리',
    strengths: ['입문 가격대에서 접근하기 쉬운 구성', '가벼운 조깅과 생활 러닝에 무난'],
    watchouts: ['훈련 강도가 올라가면 상위 모델이 필요해요'],
    pick: '러닝을 이제 막 시작해 부담 없는 한 켤레가 필요할 때예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'saucony-tide-2',
    brand: 'Saucony',
    model: '타이드 2',
    modelEn: 'Tide 2',
    sub: '입문화',
    priceBand: '엔트리',
    strengths: ['입문 가격대의 데일리 쿠션', '가벼운 조깅 위주 사용에 적합'],
    watchouts: ['국내 유통 물량이 제한적일 수 있어요'],
    pick: '가격 부담 없이 소니 쿠션을 경험해 보고 싶을 때예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'saucony-ride-19',
    brand: 'Saucony',
    model: '라이드 19',
    modelEn: 'Ride 19',
    sub: '입문화',
    strengths: ['부드러움과 반응성의 균형이 좋은 스테디셀러', '데일리 주행 거리 대부분을 커버'],
    watchouts: ['맥스 쿠션 수준의 푹신함은 아니에요'],
    pick: '한 켤레로 대부분의 데일리 러닝을 해결하고 싶을 때예요.',
  }),
  define({
    id: 'puma-electrify-nitro-4',
    brand: 'PUMA',
    model: '일렉트리파이 나이트로 4',
    modelEn: 'Electrify NITRO 4',
    sub: '입문화',
    strengths: ['나이트로 폼의 가벼운 반발감', '가격 대비 만족도가 좋은 데일리 구성'],
    watchouts: ['국내 매장 재고가 브랜드별로 편차가 있어요'],
    pick: '가성비 좋은 데일리 트레이너를 찾는다면 유력 후보예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'hoka-clifton-10',
    brand: 'HOKA',
    model: '클리프톤 10',
    modelEn: 'Clifton 10',
    sub: '입문화',
    strengths: ['호카 특유의 두툼한 쿠션을 가볍게 담은 구성', '데일리 조깅에서 발이 편한 착화감'],
    watchouts: ['호카 고유의 롤링 감각은 호불호가 있어요'],
    pick: '푹신함과 가벼움을 동시에 원할 때 가장 무난한 호카예요.',
    verification: 'official-checked',
  }),
  define({
    id: 'brooks-ghost-17',
    brand: 'Brooks',
    model: '고스트 17',
    modelEn: 'Ghost 17',
    sub: '입문화',
    strengths: ['달리기와 걷기를 함께 쓰기 좋은 편안함', '자극 적은 부드러운 착지감'],
    watchouts: ['가볍고 빠른 느낌은 우선순위가 아니에요'],
    pick: '무릎·발목 부담을 줄이는 편안한 데일리를 찾을 때예요.',
    verification: 'official-checked',
  }),
  define({
    id: 'mizuno-wave-rider-29',
    brand: 'Mizuno',
    model: '웨이브 라이더 29',
    modelEn: 'Wave Rider 29',
    sub: '입문화',
    strengths: ['오래 이어온 데일리 라인의 안정된 완성도', '단단하지 않고 균형 잡힌 주행감'],
    watchouts: ['국내 사이즈·폭 재고 확인이 필요해요'],
    pick: '미즈노 데일리의 기준을 경험하고 싶을 때예요.',
    verification: 'official-checked',
  }),
  define({
    id: 'mizuno-neo-cosmo',
    brand: 'Mizuno',
    model: '네오 코스모',
    modelEn: 'Neo Cosmo',
    sub: '입문화',
    strengths: ['네오 계열의 가벼운 착화감', '일상 러닝과 생활 착용을 함께 고려한 성격'],
    watchouts: ['본격 훈련용으로는 지지력이 부족할 수 있어요'],
    pick: '가볍고 편한 데일리 한 켤레를 원할 때예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'on-cloudsurfer-2',
    brand: 'On',
    model: '클라우드 서퍼 2',
    modelEn: 'Cloudsurfer 2',
    sub: '입문화',
    strengths: ['클라우드텍 구조 특유의 부드러운 착지', '도심 러닝에 어울리는 디자인'],
    watchouts: ['On 특유의 구조감은 착화감 호불호가 있어요'],
    pick: '디자인까지 챙기고 싶은 데일리 러너에게 맞아요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'on-cloudsurfer-next',
    brand: 'On',
    model: '클라우드 서퍼 넥스트',
    modelEn: 'Cloudsurfer Next',
    sub: '입문화',
    strengths: ['서퍼 계열을 가볍게 다듬은 구성', '가벼운 조깅에서 경쾌한 느낌'],
    watchouts: ['쿠션 총량은 맥스 쿠션화보다 적어요'],
    pick: '서퍼가 무겁게 느껴졌다면 이 쪽을 비교해 보세요.',
    specNote: UNVERIFIED_SPEC,
  }),
];

const dailyMaxCushionShoes: ShoeEntry[] = [
  define({
    id: 'nike-vomero-18',
    brand: 'Nike',
    model: '보메로 18',
    modelEn: 'Vomero 18',
    sub: '맥스 쿠션화',
    strengths: ['나이키 데일리 중 가장 두툼한 쿠션 라인', '장거리 조깅과 회복주에 여유 있는 완충'],
    watchouts: ['무게가 있어 빠른 훈련에는 둔하게 느껴져요'],
    pick: '나이키에서 푹신함 하나만 보고 고른다면 보메로예요.',
    dropMm: 10,
    specNote: DROP_CONFIRMED,
  }),
  define({
    id: 'nike-vomero-plus',
    brand: 'Nike',
    model: '보메로 플러스',
    modelEn: 'Vomero Plus',
    sub: '맥스 쿠션화',
    strengths: ['보메로 계열에서 반발감을 더한 구성', '긴 거리에서도 지치지 않는 승차감'],
    watchouts: ['두꺼운 스택 특성상 접지감은 덜해요'],
    pick: '푹신함에 통통 튀는 느낌까지 원할 때예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'nike-vomero-premium',
    brand: 'Nike',
    model: '보메로 프리미엄',
    modelEn: 'Vomero Premium',
    sub: '맥스 쿠션화',
    priceBand: '프리미엄',
    strengths: ['보메로 라인의 최상위 쿠션 구성', '회복주에서 특히 여유로운 완충'],
    watchouts: ['가격대가 데일리화 중 최상단이에요'],
    pick: '회복주 전용으로 가장 편한 한 켤레를 두고 싶을 때예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'adidas-supernova-prima-2',
    brand: 'adidas',
    model: '슈퍼노바 프리마 2',
    modelEn: 'Supernova Prima 2',
    sub: '맥스 쿠션화',
    strengths: ['상위 폼을 데일리에 적용한 부드러운 승차감', '긴 거리에서 발 피로가 덜한 구성'],
    watchouts: ['안정 지지 기능은 강조되지 않아요'],
    pick: '아디다스 데일리에서 가장 푹신한 선택지예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'asics-gel-nimbus-28',
    brand: 'ASICS',
    model: '젤 님버스 28',
    modelEn: 'GEL-NIMBUS 28',
    sub: '맥스 쿠션화',
    strengths: ['부드러운 착지와 넉넉한 완충의 대표주자', '장거리 조깅에서 안정적인 편안함'],
    watchouts: ['무게가 있어 스피드 훈련과는 성격이 달라요'],
    pick: '푹신함 하나로 고른다면 가장 검증된 이름이에요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'asics-glideride-max-2',
    brand: 'ASICS',
    model: '글라이드라이드 맥스 2',
    modelEn: 'GlideRide Max 2',
    sub: '맥스 쿠션화',
    strengths: ['앞으로 굴러가는 롤링 지오메트리', '긴 거리에서 힘을 아껴 주는 주행감'],
    watchouts: ['롤링 성향이 강해 익숙해질 시간이 필요해요'],
    pick: '오래 달릴 때 발이 알아서 굴러가는 느낌을 원할 때예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'new-balance-more-v6',
    brand: 'New Balance',
    model: '모어 V6',
    modelEn: 'Fresh Foam X More v6',
    sub: '맥스 쿠션화',
    strengths: ['뉴발란스 라인 중 가장 두꺼운 스택 계열', '회복주에서 부담을 크게 줄여 주는 완충'],
    watchouts: ['무게와 부피감이 있어 빠른 주행엔 부적합해요'],
    pick: '푹신함의 최대치를 뉴발란스에서 찾는다면 모어예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'saucony-triumph-24',
    brand: 'Saucony',
    model: '트라이엄프 24',
    modelEn: 'Triumph 24',
    sub: '맥스 쿠션화',
    strengths: ['부드러움과 반발을 함께 살린 상위 데일리', '장거리에서도 밑창이 죽지 않는 느낌'],
    watchouts: ['맥스 쿠션 중에서는 무른 쪽은 아니에요'],
    pick: '푹신하면서도 밀어주는 느낌을 포기하기 싫을 때예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'puma-magnify-nitro-3',
    brand: 'PUMA',
    model: '매그니파이 나이트로 3',
    modelEn: 'Magnify NITRO 3',
    sub: '맥스 쿠션화',
    strengths: ['나이트로 폼 기반의 가벼운 맥스 쿠션', '두툼한 스택 대비 무게 부담이 적은 편'],
    watchouts: ['국내 사이즈 재고 편차가 있어요'],
    pick: '푹신한데 무겁지 않은 데일리를 찾을 때예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'puma-magmax-nitro-2',
    brand: 'PUMA',
    model: '매그맥스 나이트로 2',
    modelEn: 'MagMax NITRO 2',
    sub: '맥스 쿠션화',
    strengths: ['푸마 라인에서 스택이 가장 두꺼운 계열', '느린 페이스 장거리에 여유로운 완충'],
    watchouts: ['두께가 커서 발목 안정감은 취향을 타요'],
    pick: '최대 쿠션을 푸마에서 경험하고 싶을 때예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'hoka-bondi-9',
    brand: 'HOKA',
    model: '본디 9',
    modelEn: 'Bondi 9',
    sub: '맥스 쿠션화',
    strengths: ['맥스 쿠션의 대명사로 통하는 완충량', '장시간 서 있거나 걷는 용도로도 인기'],
    watchouts: ['무게가 있어 빠른 훈련에는 맞지 않아요'],
    pick: '무조건 제일 푹신한 걸 원한다면 본디부터 신어 보세요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'brooks-ghost-max-3',
    brand: 'Brooks',
    model: '고스트 맥스 3',
    modelEn: 'Ghost Max 3',
    sub: '맥스 쿠션화',
    strengths: ['고스트의 편안함에 스택을 더한 구성', '넓은 바닥면에서 오는 안정된 착지'],
    watchouts: ['부피감이 있어 날렵한 핏은 아니에요'],
    pick: '편안함과 안정감을 동시에 챙기고 싶을 때예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'brooks-glycerin-23',
    brand: 'Brooks',
    model: '글리세린 23',
    modelEn: 'Glycerin 23',
    sub: '맥스 쿠션화',
    strengths: ['브룩스 라인에서 가장 부드러운 데일리', '발 아래가 고르게 눌리는 균일한 쿠션'],
    watchouts: ['반발감보다 완충 위주라 템포엔 둔해요'],
    pick: '브룩스에서 푹신함을 우선한다면 글리세린이에요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'brooks-glycerin-max-2',
    brand: 'Brooks',
    model: '글리세린 맥스 2',
    modelEn: 'Glycerin Max 2',
    sub: '맥스 쿠션화',
    priceBand: '프리미엄',
    strengths: ['글리세린 계열의 스택 최대화 버전', '회복주에서 다리 부담을 크게 줄이는 성격'],
    watchouts: ['무게·부피 모두 큰 편이에요'],
    pick: '회복 전용 한 켤레를 브룩스로 두고 싶을 때예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'mizuno-wave-sky-9',
    brand: 'Mizuno',
    model: '웨이브 스카이 9',
    modelEn: 'Wave Sky 9',
    sub: '맥스 쿠션화',
    strengths: ['미즈노 데일리 중 가장 두꺼운 쿠션 라인', '긴 거리에서 안정적인 완충'],
    watchouts: ['국내 재고와 폭 옵션 확인이 필요해요'],
    pick: '미즈노 착화감을 좋아하면서 더 푹신함을 원할 때예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'on-cloudsurfer-max',
    brand: 'On',
    model: '클라우드 서퍼 맥스',
    modelEn: 'Cloudsurfer Max',
    sub: '맥스 쿠션화',
    strengths: ['On 데일리 계열의 쿠션 최대치', '도심 장거리 조깅에 어울리는 승차감'],
    watchouts: ['On 특유의 구조감은 호불호가 갈려요'],
    pick: 'On을 좋아하는데 더 편한 쿠션이 필요할 때예요.',
    specNote: UNVERIFIED_SPEC,
  }),
];

const dailyStabilityShoes: ShoeEntry[] = [
  define({
    id: 'nike-structure-26',
    brand: 'Nike',
    model: '스트럭처 26',
    modelEn: 'Structure 26',
    sub: '안정화',
    strengths: ['나이키 데일리의 대표 안정화 라인', '발이 안쪽으로 무너지는 느낌을 줄여 주는 구조'],
    watchouts: ['안정 구조 때문에 무게가 있는 편이에요'],
    pick: '평발이나 과내전이 걱정된다면 첫 후보로 좋아요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'nike-structure-plus',
    brand: 'Nike',
    model: '스트럭처 플러스',
    modelEn: 'Structure Plus',
    sub: '안정화',
    priceBand: '하이',
    strengths: ['스트럭처 계열에 쿠션을 보강한 상위 구성', '안정감과 편안함을 함께 챙긴 성격'],
    watchouts: ['기본형보다 가격대가 올라가요'],
    pick: '안정화인데 딱딱한 건 싫을 때 비교해 보세요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'adidas-supernova-solution-3',
    brand: 'adidas',
    model: '슈퍼노바 솔루션 3',
    modelEn: 'Supernova Solution 3',
    sub: '안정화',
    strengths: ['부드러운 쿠션 위에 얹은 지지 구조', '입문자도 부담 없는 안정화 성격'],
    watchouts: ['강한 교정형 안정화를 기대하면 약하게 느껴져요'],
    pick: '살짝만 잡아주는 안정화를 찾을 때 무난해요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'asics-gt-2000-14',
    brand: 'ASICS',
    model: 'GT-2000 14',
    modelEn: 'GT-2000 14',
    sub: '안정화',
    strengths: ['오래된 안정화 라인의 검증된 균형', '카야노보다 가볍고 실용적인 구성'],
    watchouts: ['최고 수준의 쿠션량은 아니에요'],
    pick: '가격과 안정감을 함께 보는 표준 안정화예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'asics-gel-kayano-33',
    brand: 'ASICS',
    model: '젤 카야노 33',
    modelEn: 'GEL-KAYANO 33',
    sub: '안정화',
    priceBand: '하이',
    distances: ['10K', '하프', '장거리조깅'],
    strengths: ['안정화의 대표 이름값', '쿠션과 지지를 동시에 끌어올린 구성'],
    watchouts: ['무게가 있어 스피드 훈련과는 성격이 달라요'],
    pick: '안정화 하나만 제대로 사겠다면 기준이 되는 모델이에요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'new-balance-vongo-v6',
    brand: 'New Balance',
    model: '봉고 V6',
    modelEn: 'Fresh Foam X Vongo v6',
    sub: '안정화',
    strengths: ['딱딱한 지지대 대신 폼 구조로 잡아 주는 방식', '자연스러운 착화감의 안정화'],
    watchouts: ['국내 유통 물량이 많지 않을 수 있어요'],
    pick: '안정화 특유의 이물감이 싫었다면 여기를 보세요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'new-balance-860-v15',
    brand: 'New Balance',
    model: '860 V15',
    modelEn: 'Fresh Foam X 860v15',
    sub: '안정화',
    strengths: ['880의 안정화 버전에 해당하는 포지션', '폭 옵션 선택지가 넓은 편'],
    watchouts: ['개성보다 무난함에 초점이 맞춰져 있어요'],
    pick: '880이 편했는데 지지력이 조금 더 필요할 때예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'saucony-guide-19',
    brand: 'Saucony',
    model: '가이드 19',
    modelEn: 'Guide 19',
    sub: '안정화',
    strengths: ['부드럽게 잡아 주는 센터패스 방식의 지지', '데일리 대부분을 소화하는 균형'],
    watchouts: ['강한 교정을 원하면 부족할 수 있어요'],
    pick: '소니 데일리에서 안정감을 더하고 싶을 때예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'saucony-tempus-3',
    brand: 'Saucony',
    model: '템퍼스 3',
    modelEn: 'Tempus 3',
    sub: '안정화',
    priceBand: '하이',
    purposeTags: ['데일리조깅', '안정지지', '스피드훈련'],
    strengths: ['안정화인데도 경쾌하게 나가는 주행감', '템포 주행까지 커버하는 드문 성격'],
    watchouts: ['푹신함 위주의 안정화를 찾으면 방향이 달라요'],
    pick: '안정화로 빠른 훈련까지 하고 싶을 때 유일에 가까운 답이에요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'saucony-hurricane-25',
    brand: 'Saucony',
    model: '허리케인 25',
    modelEn: 'Hurricane 25',
    sub: '안정화',
    priceBand: '하이',
    distances: ['10K', '하프', '장거리조깅'],
    strengths: ['소니 안정화 중 쿠션이 가장 두툼한 계열', '장거리에서 편안함과 지지를 함께'],
    watchouts: ['무게가 있는 편이에요'],
    pick: '긴 거리를 안정적으로 편하게 달리고 싶을 때예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'puma-foreverrun-nitro-2',
    brand: 'PUMA',
    model: '포에버런 나이트로 2',
    modelEn: 'ForeverRun NITRO 2',
    sub: '안정화',
    strengths: ['나이트로 폼 기반의 가벼운 안정화', '지지 구조 대비 무겁지 않은 무게감'],
    watchouts: ['국내 매장에서 실물 확인이 어려울 수 있어요'],
    pick: '안정화가 무겁게 느껴졌다면 대안이 될 수 있어요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'hoka-arahi-8',
    brand: 'HOKA',
    model: '아라히 8',
    modelEn: 'Arahi 8',
    sub: '안정화',
    strengths: ['J-프레임 방식의 가벼운 안정 구조', '호카 안정화 중 가장 가벼운 축'],
    watchouts: ['최대 쿠션을 원하면 가비오타를 보세요'],
    pick: '가벼운 안정화를 찾는다면 호카의 첫 선택이에요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'hoka-gaviota-6',
    brand: 'HOKA',
    model: '가비오타 6',
    modelEn: 'Gaviota 6',
    sub: '안정화',
    priceBand: '하이',
    distances: ['10K', '하프', '장거리조깅'],
    strengths: ['호카 안정화 중 쿠션량이 가장 큰 구성', '장거리에서 흔들림을 줄여 주는 넓은 바닥'],
    watchouts: ['무게와 부피가 큰 편이에요'],
    pick: '푹신함과 지지력 둘 다 최대치로 원할 때예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'brooks-adrenaline-gts-25',
    brand: 'Brooks',
    model: '아드레날린 GTS 25',
    modelEn: 'Adrenaline GTS 25',
    sub: '안정화',
    strengths: ['가장 널리 팔린 안정화 라인 중 하나', '가드레일 방식의 자연스러운 지지'],
    watchouts: ['특별히 가볍거나 빠른 성격은 아니에요'],
    pick: '실패 확률이 낮은 안정화를 찾는다면 기본값이에요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'brooks-glycerin-gts-23',
    brand: 'Brooks',
    model: '글리세린 GTS 23',
    modelEn: 'Glycerin GTS 23',
    sub: '안정화',
    priceBand: '하이',
    distances: ['10K', '하프', '장거리조깅'],
    strengths: ['글리세린의 부드러움에 지지 구조를 더한 구성', '장거리 회복주에 적합한 편안함'],
    watchouts: ['가격대가 안정화 중 높은 편이에요'],
    pick: '푹신한 안정화를 원할 때 가장 무난한 답이에요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'brooks-hyperion-gts-2',
    brand: 'Brooks',
    model: '하이페리온 GTS 2',
    modelEn: 'Hyperion GTS 2',
    sub: '안정화',
    distances: ['5K', '10K', '하프'],
    purposeTags: ['스피드훈련', '안정지지', '데일리조깅'],
    strengths: ['경량 트레이너에 가까운 가벼운 안정화', '템포 주행에서도 지지력이 유지되는 성격'],
    watchouts: ['쿠션량은 데일리 안정화보다 적어요'],
    pick: '가볍게 달리면서도 잡아 주는 느낌이 필요할 때예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'mizuno-wave-horizon-8',
    brand: 'Mizuno',
    model: '웨이브 호라이즌 8',
    modelEn: 'Wave Horizon 8',
    sub: '안정화',
    priceBand: '하이',
    distances: ['10K', '하프', '장거리조깅'],
    strengths: ['미즈노 안정화 중 쿠션이 두툼한 상위 라인', '웨이브 구조 기반의 안정감'],
    watchouts: ['국내 재고 확인이 필요해요'],
    pick: '미즈노에서 안정감과 쿠션을 함께 원할 때예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'mizuno-wave-inspire-22',
    brand: 'Mizuno',
    model: '웨이브 인스파이어 22',
    modelEn: 'Wave Inspire 22',
    sub: '안정화',
    strengths: ['웨이브 라이더의 안정화 버전 포지션', '단단하지 않게 잡아 주는 균형'],
    watchouts: ['맥스 쿠션 수준의 완충은 아니에요'],
    pick: '라이더가 좋았는데 지지력이 조금 더 필요할 때예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'on-cloudrunner-3',
    brand: 'On',
    model: '클라우드러너 3',
    modelEn: 'Cloudrunner 3',
    sub: '안정화',
    strengths: ['On 라인에서 지지 성격이 강한 데일리', '도심 러닝과 생활 착용을 함께 고려'],
    watchouts: ['교정형 안정화라기보다 가벼운 지지에 가까워요'],
    pick: 'On을 쓰면서 조금 더 안정감을 원할 때예요.',
    specNote: UNVERIFIED_SPEC,
  }),
];

const dailyAllrounderShoes: ShoeEntry[] = [
  define({
    id: 'adidas-sl-2',
    brand: 'adidas',
    model: 'SL 2',
    modelEn: 'Adizero SL 2',
    sub: '올라운더',
    strengths: ['가벼운 무게와 데일리 내구성의 균형', '조깅부터 템포까지 넓게 쓰는 만능형'],
    watchouts: ['최대 쿠션을 원하면 부족하게 느껴져요'],
    pick: '한 켤레로 다 하고 싶다면 가성비가 가장 좋은 축이에요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'asics-novablast-5',
    brand: 'ASICS',
    model: '노바블라스트 5',
    modelEn: 'NOVABLAST 5',
    sub: '올라운더',
    priceBand: '하이',
    strengths: ['통통 튀는 반발감으로 유명한 데일리', '조깅과 템포 모두 즐거운 주행감'],
    watchouts: ['반발이 강해 안정감은 상대적으로 덜해요'],
    pick: '달리는 재미를 우선한다면 가장 추천하기 쉬운 모델이에요.',
    dropMm: 8,
    specNote: DROP_CONFIRMED,
  }),
  define({
    id: 'new-balance-1080-v15',
    brand: 'New Balance',
    model: '1080 V15',
    modelEn: 'Fresh Foam X 1080v15',
    sub: '올라운더',
    priceBand: '하이',
    strengths: ['부드러운 쿠션과 넓은 활용도의 조합', '일상 조깅부터 장거리까지 두루 소화'],
    watchouts: ['빠른 훈련 전용으로는 반응성이 아쉬워요'],
    pick: '편안함 중심의 만능 데일리를 찾을 때예요.',
    dropMm: 6,
    specNote: DROP_CONFIRMED,
  }),
  define({
    id: 'puma-velocity-nitro-4',
    brand: 'PUMA',
    model: '벨로시티 나이트로 4',
    modelEn: 'Velocity NITRO 4',
    sub: '올라운더',
    strengths: ['가격 대비 완성도가 좋은 만능 데일리', '나이트로 폼의 경쾌한 반발'],
    watchouts: ['국내 사이즈 재고 편차가 있어요'],
    pick: '가성비 만능화를 찾는다면 첫 손에 꼽혀요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'hoka-skyflow',
    brand: 'HOKA',
    model: '스카이플로우',
    modelEn: 'Skyflow',
    sub: '올라운더',
    priceBand: '하이',
    strengths: ['클리프톤과 본디 사이를 메우는 포지션', '부드러우면서도 무겁지 않은 균형'],
    watchouts: ['성격이 중간이라 뚜렷한 개성은 적어요'],
    pick: '클리프톤은 얇고 본디는 무거웠다면 정답일 수 있어요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'brooks-glycerin-flex',
    brand: 'Brooks',
    model: '글리세린 플렉스',
    modelEn: 'Glycerin Flex',
    sub: '올라운더',
    strengths: ['글리세린 계열을 유연하게 다듬은 구성', '일상 착용과 러닝을 함께 고려한 성격'],
    watchouts: ['본격 훈련용 지지력은 강하지 않아요'],
    pick: '러닝과 일상을 한 켤레로 묶고 싶을 때예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'mizuno-neo-zen-2',
    brand: 'Mizuno',
    model: '네오 젠 2',
    modelEn: 'Neo Zen 2',
    sub: '올라운더',
    strengths: ['네오 계열 특유의 부드럽고 가벼운 감각', '데일리 조깅에서 편안한 균형'],
    watchouts: ['국내 재고와 사이즈 확인이 필요해요'],
    pick: '미즈노의 새로운 폼 감각을 데일리로 써보고 싶을 때예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'on-cloudmonster-3',
    brand: 'On',
    model: '클라우드몬스터 3',
    modelEn: 'Cloudmonster 3',
    sub: '올라운더',
    priceBand: '하이',
    strengths: ['On 라인에서 반발감이 가장 뚜렷한 데일리', '두툼한 스택과 경쾌한 롤링'],
    watchouts: ['구조감이 강해 착화감 호불호가 있어요'],
    pick: 'On에서 재미있게 달리는 한 켤레를 찾는다면 여기예요.',
    specNote: UNVERIFIED_SPEC,
  }),
];

const dailyLightTrainerShoes: ShoeEntry[] = [
  define({
    id: 'nike-rivalfly-4',
    brand: 'Nike',
    model: '라이벌플라이 4',
    modelEn: 'Zoom Rival Fly 4',
    sub: '경량 트레이너',
    strengths: ['가벼운 무게의 접근성 좋은 스피드 훈련화', '가격 부담이 적은 편'],
    watchouts: ['쿠션량이 적어 장거리에는 부담이 있어요'],
    pick: '인터벌·질주 훈련용 저렴한 한 켤레가 필요할 때예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'adidas-adizero-adios-9',
    brand: 'adidas',
    model: '아디제로 아디오스 9',
    modelEn: 'Adizero Adios 9',
    sub: '경량 트레이너',
    priceBand: '미들',
    distances: ['5K', '10K', '하프'],
    strengths: ['땅을 또렷하게 느끼는 경량 주행감', '템포·인터벌에서 리듬을 잡기 좋은 성격'],
    watchouts: ['쿠션이 얇아 발 부담이 큰 편이에요'],
    pick: '접지감을 중시하는 스피드 훈련화를 원할 때예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'asics-evoride-speed-3',
    brand: 'ASICS',
    model: '에보라이드 스피드 3',
    modelEn: 'EvoRide Speed 3',
    sub: '경량 트레이너',
    strengths: ['롤링 구조로 힘을 아껴 주는 경량화', '가격 대비 활용도가 넓은 편'],
    watchouts: ['최대 반발을 기대하면 밋밋할 수 있어요'],
    pick: '가볍게 페이스를 올리는 훈련에 부담 없이 쓰기 좋아요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'new-balance-rebel-v5',
    brand: 'New Balance',
    model: '레벨 V5',
    modelEn: 'FuelCell Rebel v5',
    sub: '경량 트레이너',
    priceBand: '미들',
    distances: ['5K', '10K', '하프'],
    strengths: ['가벼운데 쿠션까지 챙긴 드문 균형', '데일리와 템포를 넘나드는 활용도'],
    watchouts: ['가벼운 만큼 내구성 관리가 필요해요'],
    pick: '경량 트레이너 하나만 고른다면 가장 자주 추천되는 이름이에요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'saucony-kinvara-16',
    brand: 'Saucony',
    model: '킨바라 16',
    modelEn: 'Kinvara 16',
    sub: '경량 트레이너',
    strengths: ['오래된 경량화 라인의 가벼움', '발을 자연스럽게 쓰게 하는 성격'],
    watchouts: ['쿠션이 얇아 장거리 반복은 부담돼요'],
    pick: '가벼움 자체를 즐기는 러너에게 잘 맞아요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'hoka-rincon-4',
    brand: 'HOKA',
    model: '링컨 4',
    modelEn: 'Rincon 4',
    sub: '경량 트레이너',
    distances: ['5K', '10K', '하프'],
    strengths: ['호카 라인에서 가장 가벼운 축의 데일리', '쿠션 대비 무게가 매우 가벼운 편'],
    watchouts: ['아웃솔 내구성은 관리가 필요해요'],
    pick: '호카의 쿠션을 가볍게 쓰고 싶을 때 답이에요.',
    specNote: UNVERIFIED_SPEC,
  }),
];

const superTrainerNonPlateShoes: ShoeEntry[] = [
  define({
    id: 'nike-pegasus-plus',
    brand: 'Nike',
    model: '페가수스 플러스',
    modelEn: 'Pegasus Plus',
    sub: '논 플레이트',
    strengths: ['전체 폼을 상위 소재로 채운 경쾌한 주행', '데일리와 템포를 함께 쓰는 활용도'],
    watchouts: ['얇은 어퍼라 발볼이 넓으면 조일 수 있어요'],
    pick: '페가수스보다 한 단계 빠른 감각을 원할 때예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'adidas-evo-sl',
    brand: 'adidas',
    model: '에보 SL',
    modelEn: 'Adizero EVO SL',
    sub: '논 플레이트',
    priceBand: '미들',
    strengths: ['레이싱 폼을 플레이트 없이 담은 구성', '가벼움과 반발감의 균형이 좋은 편'],
    watchouts: ['부드러운 쿠션 위주의 사용에는 맞지 않아요'],
    pick: '슈퍼트레이너 입문으로 가장 많이 언급되는 모델이에요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'adidas-hyperboost-edge',
    brand: 'adidas',
    model: '하이퍼부스트 엣지',
    modelEn: 'Hyperboost Edge',
    sub: '논 플레이트',
    strengths: ['부스트 계열 폼의 반발을 살린 구성', '데일리 훈련에서 경쾌한 반동감'],
    watchouts: ['국내 유통·사이즈 확인이 필요해요'],
    pick: '반발감 있는 훈련화를 아디다스에서 찾을 때예요.',
    specNote: UNVERIFIED_PLATE,
  }),
  define({
    id: 'asics-superblast-3',
    brand: 'ASICS',
    model: '슈퍼블라스트 3',
    modelEn: 'Superblast 3',
    sub: '논 플레이트',
    priceBand: '프리미엄',
    distances: ['10K', '하프', '풀', '장거리조깅'],
    strengths: ['플레이트 없이도 레이싱급으로 평가받는 주행감', '조깅·템포·장거리까지 하나로 소화'],
    watchouts: ['가격대가 데일리화 중 최상단이에요'],
    pick: '한 켤레만 사야 한다면 가장 자주 1순위로 꼽히는 모델이에요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'asics-megablast',
    brand: 'ASICS',
    model: '메가블라스트',
    modelEn: 'Megablast',
    sub: '논 플레이트',
    priceBand: '프리미엄',
    distances: ['10K', '하프', '풀', '장거리조깅'],
    strengths: ['블라스트 계열의 쿠션을 키운 구성', '긴 거리 훈련에 여유 있는 완충'],
    watchouts: ['부피가 커서 날렵한 느낌은 덜해요'],
    pick: '슈퍼블라스트가 좋았는데 더 푹신함을 원할 때예요.',
    specNote: UNVERIFIED_PLATE,
  }),
  define({
    id: 'new-balance-balos',
    brand: 'New Balance',
    model: '발로스',
    modelEn: 'FuelCell Balos',
    sub: '논 플레이트',
    priceBand: '하이',
    strengths: ['두툼한 스택과 반발을 함께 담은 구성', '장거리 훈련에서 힘을 아껴 주는 성격'],
    watchouts: ['무게가 가볍지는 않아요'],
    pick: '뉴발란스에서 슈퍼트레이너를 찾는다면 대표 후보예요.',
    specNote: UNVERIFIED_PLATE,
  }),
  define({
    id: 'saucony-endorphin-azura',
    brand: 'Saucony',
    model: '엔돌핀 아주라',
    modelEn: 'Endorphin Azura',
    sub: '논 플레이트',
    strengths: ['엔돌핀 계열의 감각을 부드럽게 다듬은 구성', '플레이트 없이 편안한 훈련 주행'],
    watchouts: ['레이싱급 반발을 기대하면 온화하게 느껴져요'],
    pick: '엔돌핀 라인을 데일리로 쓰고 싶을 때예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'puma-deviate-pure-nitro',
    brand: 'PUMA',
    model: '디비에이트 퓨어 나이트로',
    modelEn: 'Deviate Pure NITRO',
    sub: '논 플레이트',
    strengths: ['디비에이트 계열에서 플레이트를 뺀 구성', '훈련용으로 부담이 적은 주행감'],
    watchouts: ['국내 유통 물량 확인이 필요해요'],
    pick: '카본이 부담스러운 러너의 푸마 훈련화예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'hoka-mach-7',
    brand: 'HOKA',
    model: '마하 7',
    modelEn: 'Mach 7',
    sub: '논 플레이트',
    priceBand: '미들',
    strengths: ['가벼우면서 쿠션도 챙긴 호카의 훈련화', '템포와 데일리를 함께 쓰기 좋은 균형'],
    watchouts: ['최대 쿠션을 원하면 부족해요'],
    pick: '호카에서 빠르게 달릴 한 켤레를 고른다면 마하예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'brooks-hyperion-3',
    brand: 'Brooks',
    model: '하이페리온 3',
    modelEn: 'Hyperion 3',
    sub: '논 플레이트',
    priceBand: '미들',
    distances: ['5K', '10K', '하프'],
    strengths: ['가벼운 무게 중심의 훈련용 구성', '템포 주행에서 깔끔한 반응'],
    watchouts: ['장거리 완충은 부족한 편이에요'],
    pick: '브룩스에서 가벼운 훈련화를 원할 때예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'on-cloudmonster-3-hyper',
    brand: 'On',
    model: '클라우드몬스터 3 하이퍼',
    modelEn: 'Cloudmonster 3 Hyper',
    sub: '논 플레이트',
    priceBand: '프리미엄',
    strengths: ['몬스터 계열의 상위 폼 버전', '반발과 쿠션을 함께 끌어올린 구성'],
    watchouts: ['가격대가 높은 편이에요'],
    pick: '몬스터를 더 좋은 폼으로 쓰고 싶을 때예요.',
    specNote: UNVERIFIED_PLATE,
  }),
  define({
    id: 'on-cloudmonster-3-hyper-ls',
    brand: 'On',
    model: '클라우드몬스터 3 하이퍼 LS',
    modelEn: 'Cloudmonster 3 Hyper LS',
    sub: '논 플레이트',
    priceBand: '프리미엄',
    strengths: ['하이퍼 구성의 라이프스타일 지향 버전', '데일리 착용까지 고려한 디자인'],
    watchouts: ['러닝 전용 성능만 본다면 기본형이 합리적이에요'],
    pick: '디자인까지 챙긴 상위 On을 원할 때예요.',
    specNote: UNVERIFIED_PLATE,
  }),
];

const superTrainerLightPlateShoes: ShoeEntry[] = [
  define({
    id: 'adidas-adizero-boston-13',
    brand: 'adidas',
    model: '아디제로 보스턴 13',
    modelEn: 'Adizero Boston 13',
    sub: '라이트 플레이트',
    distances: ['10K', '하프', '풀', '장거리조깅'],
    purposeTags: ['스피드훈련', '대회레이스', '데일리조깅'],
    strengths: ['에너지로드 구조로 밀어 주는 주행감', '훈련과 대회를 한 켤레로 소화'],
    watchouts: ['단단한 편이라 회복주에는 맞지 않아요'],
    pick: '카본 레이서 전 단계로 가장 많이 쓰이는 훈련화예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'asics-sonicblast',
    brand: 'ASICS',
    model: '소닉블라스트',
    modelEn: 'Sonicblast',
    sub: '라이트 플레이트',
    priceBand: '프리미엄',
    strengths: ['블라스트 계열에 추진 구조를 더한 구성', '빠른 훈련에서 또렷한 전진감'],
    watchouts: ['플레이트 사양은 공식 확인이 필요해요'],
    pick: '슈퍼블라스트보다 더 빠른 감각을 원할 때예요.',
    specNote: UNVERIFIED_PLATE,
  }),
  define({
    id: 'saucony-endorphin-speed-5',
    brand: 'Saucony',
    model: '엔돌핀 스피드 5',
    modelEn: 'Endorphin Speed 5',
    sub: '라이트 플레이트',
    distances: ['10K', '하프', '풀', '장거리조깅'],
    purposeTags: ['스피드훈련', '대회레이스', '데일리조깅'],
    strengths: ['나일론 플레이트 기반의 부드러운 추진', '훈련·대회 모두 커버하는 넓은 범용성'],
    watchouts: ['카본 레이서만큼의 강한 반발은 아니에요'],
    pick: '슈퍼트레이너 장르를 대표하는 기준 모델이에요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'hoka-mach-x3',
    brand: 'HOKA',
    model: '마하 X3',
    modelEn: 'Mach X3',
    sub: '라이트 플레이트',
    strengths: ['마하 계열에 추진 구조를 더한 상위 훈련화', '템포와 하프 대회를 함께 소화'],
    watchouts: ['데일리 회복주로는 단단해요'],
    pick: '호카로 템포 훈련을 제대로 하고 싶을 때예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'brooks-hyperion-max-3',
    brand: 'Brooks',
    model: '하이페리온 맥스 3',
    modelEn: 'Hyperion Max 3',
    sub: '라이트 플레이트',
    strengths: ['하이페리온 계열의 쿠션 강화 버전', '긴 템포 주행에서 안정된 추진'],
    watchouts: ['반발 강도는 카본 레이서보다 온화해요'],
    pick: '브룩스로 훈련과 대회를 겸하고 싶을 때예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'mizuno-neo-vista-2',
    brand: 'Mizuno',
    model: '네오 비스타 2',
    modelEn: 'Neo Vista 2',
    sub: '라이트 플레이트',
    priceBand: '프리미엄',
    distances: ['10K', '하프', '풀', '장거리조깅'],
    strengths: ['두툼한 폼과 부드러운 추진의 조합', '긴 거리에서 편안한 슈퍼트레이너'],
    watchouts: ['가격대가 높은 편이에요'],
    pick: '미즈노 슈퍼트레이너의 대표 얼굴이에요.',
    specNote: UNVERIFIED_PLATE,
  }),
  define({
    id: 'mizuno-hyperwarp-pro',
    brand: 'Mizuno',
    model: '하이퍼워프 프로',
    modelEn: 'Hyperwarp Pro',
    sub: '라이트 플레이트',
    priceBand: '프리미엄',
    strengths: ['하이퍼워프 계열의 훈련용 포지션', '레이싱 감각을 반복 훈련에 옮긴 구성'],
    watchouts: ['플레이트 사양은 공식 확인이 필요해요'],
    pick: '미즈노 레이싱 감각을 훈련에서 미리 익히고 싶을 때예요.',
    specNote: UNVERIFIED_PLATE,
  }),
  define({
    id: 'on-cloudflow-5',
    brand: 'On',
    model: '클라우드플로우 5',
    modelEn: 'Cloudflow 5',
    sub: '라이트 플레이트',
    distances: ['5K', '10K', '하프'],
    strengths: ['On 라인에서 가볍고 빠른 성격', '템포 주행에 어울리는 경쾌함'],
    watchouts: ['쿠션량은 몬스터 계열보다 적어요'],
    pick: 'On으로 스피드 훈련을 하고 싶을 때 첫 선택이에요.',
    specNote: UNVERIFIED_PLATE,
  }),
];

const superTrainerCarbonShoes: ShoeEntry[] = [
  define({
    id: 'nike-zoomfly-6',
    brand: 'Nike',
    model: '줌플라이 6',
    modelEn: 'ZoomFly 6',
    sub: '카본 플레이트',
    priceBand: '프리미엄',
    strengths: ['레이싱 계열 구조를 훈련용으로 옮긴 구성', '대회 신발에 앞서 감각을 익히기 좋음'],
    watchouts: ['무게는 순수 레이서보다 무거워요'],
    pick: '베이퍼플라이 감각을 훈련에서 연습하고 싶을 때예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'adidas-prime-x3-strung',
    brand: 'adidas',
    model: '프라임 X3 스트렁',
    modelEn: 'Prime X 3 Strung',
    sub: '카본 플레이트',
    priceBand: '프리미엄',
    distances: ['하프', '풀', '장거리조깅'],
    strengths: ['규정 밖 초고스택으로 유명한 실험적 구성', '긴 거리에서 압도적인 완충과 추진'],
    watchouts: ['공인 대회 규정 스택을 넘어 기록 인정에 제약이 있어요'],
    pick: '기록 인정과 무관하게 가장 재미있는 장거리 훈련화예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'asics-magic-speed-5',
    brand: 'ASICS',
    model: '매직스피드 5',
    modelEn: 'MAGIC SPEED 5',
    sub: '카본 플레이트',
    priceBand: '하이',
    distances: ['10K', '하프', '풀'],
    strengths: ['카본 플레이트를 합리적 가격대에 담은 구성', '훈련과 대회를 함께 쓰는 활용도'],
    watchouts: ['최상위 레이서만큼 가볍지는 않아요'],
    pick: '첫 카본화를 부담 없이 시작하기 좋은 모델이에요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'new-balance-sc-trainer-v3',
    brand: 'New Balance',
    model: 'SC 트레이너 V3',
    modelEn: 'FuelCell SuperComp Trainer v3',
    sub: '카본 플레이트',
    priceBand: '프리미엄',
    distances: ['10K', '하프', '풀', '장거리조깅'],
    strengths: ['두꺼운 스택과 플레이트를 훈련용으로 구성', '긴 거리에서 다리 부담을 덜어 주는 성격'],
    watchouts: ['부피가 커서 좁은 코너 주행은 익숙해져야 해요'],
    pick: '장거리 훈련을 편하게 끌고 가고 싶을 때예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'saucony-endorphin-trainer',
    brand: 'Saucony',
    model: '엔돌핀 트레이너',
    modelEn: 'Endorphin Trainer',
    sub: '카본 플레이트',
    priceBand: '프리미엄',
    distances: ['10K', '하프', '풀', '장거리조깅'],
    strengths: ['엔돌핀 레이싱 감각의 훈련용 버전', '반복 훈련에 견디는 구성'],
    watchouts: ['회복주용으로는 성격이 강해요'],
    pick: '엔돌핀 프로를 쓰는 러너의 짝 신발로 좋아요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'puma-deviate-nitro-4',
    brand: 'PUMA',
    model: '디비에이트 나이트로 4',
    modelEn: 'Deviate NITRO 4',
    sub: '카본 플레이트',
    priceBand: '하이',
    distances: ['10K', '하프', '풀'],
    strengths: ['카본 플레이트 훈련화 중 가격 접근성이 좋은 편', '데일리 템포까지 넓게 쓰는 성격'],
    watchouts: ['국내 사이즈 재고 확인이 필요해요'],
    pick: '가성비 카본 트레이너를 찾는다면 강력한 후보예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'hoka-skyward-x',
    brand: 'HOKA',
    model: '스카이워드 X',
    modelEn: 'Skyward X',
    sub: '카본 플레이트',
    priceBand: '프리미엄',
    distances: ['10K', '하프', '풀', '장거리조깅'],
    purposeTags: ['장거리', '데일리조깅', '스피드훈련'],
    strengths: ['초고쿠션에 플레이트를 더한 구성', '장거리 조깅에서 다리를 아껴 주는 성격'],
    watchouts: ['무게와 부피가 커서 빠른 레이스용은 아니에요'],
    pick: '가장 푹신한 플레이트 신발을 원할 때예요.',
    specNote: UNVERIFIED_SPEC,
  }),
];

const racingShortShoes: ShoeEntry[] = [
  define({
    id: 'nike-streakfly-2',
    brand: 'Nike',
    model: '스트릭플라이 2',
    modelEn: 'Streakfly 2',
    sub: '중거리',
    strengths: ['5K~10K에 맞춘 극단적 경량 구성', '발이 빠르게 회전하는 감각'],
    watchouts: ['쿠션이 얇아 풀 마라톤에는 맞지 않아요'],
    pick: '5K·10K 기록 경신을 노릴 때 특화된 선택이에요.',
    specNote: UNVERIFIED_PLATE,
  }),
  define({
    id: 'adidas-adizero-takumi-sen-11',
    brand: 'adidas',
    model: '아디제로 타쿠미 센 11',
    modelEn: 'Adizero Takumi Sen 11',
    sub: '중거리',
    strengths: ['공격적인 전진감의 중거리 레이서', '트랙과 도로 단거리 대회에 특화'],
    watchouts: ['발 부담이 커서 훈련용으로는 무리예요'],
    pick: '짧은 거리에서 최대한 공격적으로 달리고 싶을 때예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'new-balance-sc-pacer-v2',
    brand: 'New Balance',
    model: 'SC 페이서 V2',
    modelEn: 'FuelCell SuperComp Pacer v2',
    sub: '중거리',
    strengths: ['가벼운 무게와 또렷한 반발', '5K~10K 레이스에 맞춘 균형'],
    watchouts: ['장거리 완충은 부족해요'],
    pick: '뉴발란스로 짧은 레이스를 준비할 때예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'puma-propio-nitro',
    brand: 'PUMA',
    model: '프로피오 나이트로',
    modelEn: 'Propio NITRO',
    sub: '중거리',
    strengths: ['가벼운 레이싱 구성의 푸마 라인', '단거리 대회에서 경쾌한 회전'],
    watchouts: ['국내 유통 확인이 필요해요'],
    pick: '푸마로 중거리 레이스를 준비할 때예요.',
    specNote: UNVERIFIED_PLATE,
  }),
  define({
    id: 'mizuno-hyperwarp-pure',
    brand: 'Mizuno',
    model: '하이퍼워프 퓨어',
    modelEn: 'Hyperwarp Pure',
    sub: '중거리',
    strengths: ['하이퍼워프 계열의 경량 레이싱 포지션', '짧은 거리에서 날카로운 주행감'],
    watchouts: ['플레이트 사양은 공식 확인이 필요해요'],
    pick: '미즈노로 짧은 거리 기록을 노릴 때예요.',
    specNote: UNVERIFIED_PLATE,
  }),
  define({
    id: 'on-cloudboom-bolt',
    brand: 'On',
    model: '클라우드붐 볼트',
    modelEn: 'Cloudboom Bolt',
    sub: '중거리',
    strengths: ['클라우드붐 계열의 경량 레이싱 버전', '중거리 대회에 맞춘 반응성'],
    watchouts: ['플레이트 사양은 공식 확인이 필요해요'],
    pick: 'On으로 5K·10K 레이스를 준비할 때예요.',
    specNote: UNVERIFIED_PLATE,
  }),
];

const racingLongShoes: ShoeEntry[] = [
  define({
    id: 'nike-vaporfly-4',
    brand: 'Nike',
    model: '베이퍼플라이 4',
    modelEn: 'Vaporfly 4',
    sub: '장거리',
    strengths: ['마라톤 레이싱화의 기준이 된 계보', '가벼운 무게와 강한 추진의 조합'],
    watchouts: ['내구성이 짧아 대회 중심으로 아껴 써야 해요'],
    pick: '하프·풀 대회 기록을 노린다면 가장 검증된 이름이에요.',
    dropMm: 8,
    specNote: DROP_CONFIRMED,
  }),
  define({
    id: 'nike-alphafly-3',
    brand: 'Nike',
    model: '알파플라이 3',
    modelEn: 'Alphafly 3',
    sub: '장거리',
    distances: ['풀'],
    strengths: ['에어 유닛과 카본을 결합한 최상위 구성', '풀 마라톤 후반부에 강한 성격'],
    watchouts: ['무겁고 구조가 커서 페이스가 느리면 이점이 줄어요'],
    pick: '풀 마라톤 한 종목에 모든 걸 걸 때 선택해요.',
    dropMm: 8,
    stackMm: { heel: 40, forefoot: 32 },
    specNote: DROP_STACK_CONFIRMED,
  }),
  define({
    id: 'adidas-adizero-adios-pro-4',
    brand: 'adidas',
    model: '아디제로 아디오스 프로 4',
    modelEn: 'Adizero Adios Pro 4',
    sub: '장거리',
    strengths: ['에너지로드 구조의 강한 전진감', '마라톤 전 구간에서 안정된 추진'],
    watchouts: ['단단한 편이라 착지 습관에 따라 부담이 있어요'],
    pick: '아디다스 마라톤 레이싱의 정석이에요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'adidas-adizero-pro-evo-3',
    brand: 'adidas',
    model: '아디제로 프로 에보 3',
    modelEn: 'Adizero Adios Pro Evo 3',
    sub: '장거리',
    strengths: ['극단적 경량화를 노린 최상위 레이서', '대회 당일 기록에 초점을 맞춘 구성'],
    watchouts: ['내구성이 매우 짧고 가격대가 최상단이에요'],
    pick: '단 한 번의 목표 대회를 위해 준비하는 신발이에요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'adidas-prime-x-evo',
    brand: 'adidas',
    model: '프라임 X 에보',
    modelEn: 'Prime X Evo',
    sub: '장거리',
    distances: ['하프', '풀', '장거리조깅'],
    strengths: ['초고스택 기반의 압도적인 완충', '오래 달려도 다리가 덜 지치는 성격'],
    watchouts: ['공인 대회 규정 스택을 넘어 기록 인정에 제약이 있어요'],
    pick: '기록 인정보다 완주 편안함이 중요할 때 고려해요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'asics-s4-yogiri',
    brand: 'ASICS',
    model: 'S4+ 요기리',
    modelEn: 'S4+ Yogiri',
    sub: '장거리',
    strengths: ['아식스 최상위 레이싱 실험 라인', '대회 특화 구성'],
    watchouts: ['국내 유통과 사양 모두 공식 확인이 필요해요'],
    pick: '아식스 최상위 레이서를 찾는 러너를 위한 선택이에요.',
    specNote: UNVERIFIED_PLATE,
  }),
  define({
    id: 'asics-metaspeed-tokyo-sky',
    brand: 'ASICS',
    model: '메타스피드 도쿄 스카이',
    modelEn: 'METASPEED Tokyo Sky',
    sub: '장거리',
    strengths: ['보폭을 늘리는 주법에 맞춘 설계', '마라톤 후반 유지력에 초점'],
    watchouts: ['주법에 따라 엣지 모델이 더 맞을 수 있어요'],
    pick: '보폭을 넓게 쓰는 러너를 위한 아식스 레이서예요.',
    dropMm: 5,
    specNote: DROP_CONFIRMED,
  }),
  define({
    id: 'asics-metaspeed-tokyo-edge',
    brand: 'ASICS',
    model: '메타스피드 도쿄 엣지',
    modelEn: 'METASPEED Tokyo Edge',
    sub: '장거리',
    strengths: ['회전수를 올리는 주법에 맞춘 설계', '리듬을 빠르게 유지하기 좋은 구성'],
    watchouts: ['주법에 따라 스카이 모델이 더 맞을 수 있어요'],
    pick: '피치를 빠르게 가져가는 러너를 위한 아식스 레이서예요.',
    dropMm: 8,
    specNote: DROP_CONFIRMED,
  }),
  define({
    id: 'asics-metaspeed-ray',
    brand: 'ASICS',
    model: '메타스피드 레이',
    modelEn: 'METASPEED Ray',
    sub: '장거리',
    strengths: ['메타스피드 계열의 초경량 버전', '대회 당일 기록에 초점을 맞춘 구성'],
    watchouts: ['내구성이 짧고 수급이 제한적이에요'],
    pick: '가장 가벼운 아식스 레이서를 원할 때예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'new-balance-sc-elite-v5',
    brand: 'New Balance',
    model: 'SC 엘리트 V5',
    modelEn: 'FuelCell SuperComp Elite v5',
    sub: '장거리',
    strengths: ['부드러운 폼과 카본의 조합', '마라톤 후반에도 편안한 착지'],
    watchouts: ['단단한 반발을 좋아하면 무르게 느껴져요'],
    pick: '레이싱화가 딱딱해서 힘들었다면 좋은 대안이에요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'saucony-endorphin-pro-5',
    brand: 'Saucony',
    model: '엔돌핀 프로 5',
    modelEn: 'Endorphin Pro 5',
    sub: '장거리',
    strengths: ['균형 잡힌 마라톤 레이서', '스피드폼 계열의 안정된 추진'],
    watchouts: ['최상위 경량 모델보다는 무게가 있어요'],
    pick: '무난하고 실패 확률이 낮은 마라톤 레이서예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'saucony-endorphin-elite-2',
    brand: 'Saucony',
    model: '엔돌핀 엘리트 2',
    modelEn: 'Endorphin Elite 2',
    sub: '장거리',
    strengths: ['소니 최상위 레이싱 구성', '강한 반발과 경량화를 동시에'],
    watchouts: ['성격이 공격적이라 러너를 가려요'],
    pick: '소니 라인에서 최고 기록을 노릴 때 선택해요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'puma-deviate-nitro-elite-4',
    brand: 'PUMA',
    model: '디비에이트 나이트로 엘리트 4',
    modelEn: 'Deviate NITRO Elite 4',
    sub: '장거리',
    strengths: ['가벼운 무게로 평가가 좋은 마라톤 레이서', '나이트로 엘리트 폼의 반발'],
    watchouts: ['국내 수급이 제한적일 수 있어요'],
    pick: '가벼움을 최우선으로 하는 마라톤 레이서예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'puma-fast-r-nitro-elite-3',
    brand: 'PUMA',
    model: '패스트R 나이트로 엘리트 3',
    modelEn: 'FAST-R NITRO Elite 3',
    sub: '장거리',
    strengths: ['분리형 구조의 독특한 레이싱 설계', '후반부 추진에 초점을 맞춘 구성'],
    watchouts: ['구조가 특이해 적응 기간이 필요해요'],
    pick: '남들과 다른 감각의 레이서를 원할 때예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'hoka-rocket-x3',
    brand: 'HOKA',
    model: '로켓 X3',
    modelEn: 'Rocket X 3',
    sub: '장거리',
    strengths: ['호카 레이싱 라인의 대표 모델', '카본 기반의 또렷한 추진'],
    watchouts: ['호카 데일리 대비 착화감이 단단해요'],
    pick: '호카로 대회를 준비한다면 기본 선택이에요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'hoka-cielo-x1-3',
    brand: 'HOKA',
    model: '씨엘로 X1 3.0',
    modelEn: 'Cielo X1 3.0',
    sub: '장거리',
    strengths: ['호카 최상위 레이싱 구성', '큰 스택과 카본의 조합'],
    watchouts: ['무게가 있는 편이라 페이스에 따라 체감이 달라요'],
    pick: '호카 레이싱의 최상단을 원할 때예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'brooks-hyperion-elite-5',
    brand: 'Brooks',
    model: '하이페리온 엘리트 5',
    modelEn: 'Hyperion Elite 5',
    sub: '장거리',
    strengths: ['브룩스 최상위 레이싱 라인', '안정적인 착지와 추진의 균형'],
    watchouts: ['국내 유통 물량이 제한적일 수 있어요'],
    pick: '브룩스로 마라톤 대회를 준비할 때예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'mizuno-hyperwarp-elite',
    brand: 'Mizuno',
    model: '하이퍼워프 엘리트',
    modelEn: 'Hyperwarp Elite',
    sub: '장거리',
    strengths: ['미즈노 최상위 레이싱 구성', '대회 특화 경량 설계'],
    watchouts: ['플레이트 사양은 공식 확인이 필요해요'],
    pick: '미즈노로 마라톤 기록을 노릴 때 선택이에요.',
    specNote: UNVERIFIED_PLATE,
  }),
  define({
    id: 'on-cloudboom-max',
    brand: 'On',
    model: '클라우드붐 맥스',
    modelEn: 'Cloudboom Max',
    sub: '장거리',
    distances: ['하프', '풀', '장거리조깅'],
    strengths: ['레이싱 계열에서 쿠션을 키운 구성', '긴 거리에서 편안한 완충'],
    watchouts: ['최경량 레이서보다 무게가 있어요'],
    pick: '편안하게 완주하는 데 초점을 둘 때예요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'on-cloudboom-strike',
    brand: 'On',
    model: '클라우드붐 스트라이크',
    modelEn: 'Cloudboom Strike',
    sub: '장거리',
    strengths: ['On 마라톤 레이싱의 주력 모델', '가벼운 무게와 또렷한 반발'],
    watchouts: ['On 특유의 구조감 적응이 필요해요'],
    pick: 'On으로 하프·풀 대회를 준비할 때 기본 선택이에요.',
    specNote: UNVERIFIED_SPEC,
  }),
  define({
    id: 'on-cloudboom-strike-ls',
    brand: 'On',
    model: '클라우드붐 스트라이크 LS',
    modelEn: 'Cloudboom Strike LS',
    sub: '장거리',
    strengths: ['스프레이 어퍼 공법의 한정 구성', '레이싱 성능과 상징성을 함께'],
    watchouts: ['수량이 매우 제한적이고 가격대가 최상단이에요'],
    pick: '수집 가치까지 고려하는 러너를 위한 모델이에요.',
    specNote: UNVERIFIED_SPEC,
  }),
];

/** legacy `shoes` 배열에 있던 이전 세대 모델. 저장된 사용자 선택이 깨지지 않도록 유지합니다. */
const previousGenerationShoes: ShoeEntry[] = [
  define({
    id: 'adidas-supernova-rise-2',
    brand: 'adidas',
    model: '슈퍼노바 라이즈 2',
    modelEn: 'Supernova Rise 2',
    sub: '입문화',
    strengths: ['Dreamstrike+ 미드솔의 부드러운 착화감', '서포트 로드 구조의 안정감'],
    watchouts: ['다음 세대(라이즈 3)가 나와 재고가 줄어드는 중이에요'],
    pick: '이전 세대를 합리적인 가격에 구하고 싶을 때예요.',
    verification: 'official-checked',
  }),
  define({
    id: 'asics-gel-nimbus-27',
    brand: 'ASICS',
    model: '젤 님버스 27',
    modelEn: 'GEL-NIMBUS 27',
    sub: '맥스 쿠션화',
    strengths: ['PureGEL 기반의 부드러운 착지', '장거리 조깅에서 넉넉한 완충'],
    watchouts: ['다음 세대(님버스 28)와 함께 비교해 보세요'],
    pick: '검증된 맥스 쿠션을 이전 세대 가격으로 노릴 때예요.',
    verification: 'official-checked',
    dropMm: 8,
    specNote: DROP_CONFIRMED,
  }),
  define({
    id: 'new-balance-1080-v14',
    brand: 'New Balance',
    model: '1080 V14',
    modelEn: 'Fresh Foam X 1080v14',
    sub: '올라운더',
    strengths: ['Fresh Foam X 미드솔의 부드러운 승차감', '일상부터 장거리까지 넓은 활용도'],
    watchouts: ['다음 세대(V15)와 재고·가격을 비교해 보세요'],
    pick: '1080 감성을 이전 세대로 저렴하게 쓰고 싶을 때예요.',
    verification: 'official-checked',
    weightGrams: 298,
    dropMm: 6,
    specNote: WEIGHT_DROP_CONFIRMED,
  }),
  define({
    id: 'saucony-ride-18',
    brand: 'Saucony',
    model: '라이드 18',
    modelEn: 'Ride 18',
    sub: '입문화',
    strengths: ['PWRRUN+ 미드솔의 균형 잡힌 주행감', '데일리 대부분을 커버하는 범용성'],
    watchouts: ['다음 세대(라이드 19)와 함께 비교해 보세요'],
    pick: '검증된 데일리를 이전 세대 가격으로 구할 때예요.',
    verification: 'official-checked',
  }),
];

/**
 * 확장 카탈로그 정본입니다.
 * 순서 자체가 기본 "추천순" 정렬(데일리 → 슈퍼트레이너 → 레이싱)로 쓰입니다.
 */
/**
 * 같은 세부 카테고리 안에서 자주 함께 비교되는 대표 조합입니다.
 * 여기 없는 항목은 아래 autoComparisons가 같은 세부 카테고리의 다른 브랜드로 채웁니다.
 */
const curatedComparisons: Readonly<Record<string, readonly string[]>> = {
  'nike-pegasus-42': ['asics-gel-cumulus-28', 'brooks-ghost-17'],
  'asics-gel-cumulus-28': ['nike-pegasus-42', 'brooks-ghost-17'],
  'brooks-ghost-17': ['nike-pegasus-42', 'asics-gel-cumulus-28'],
  'hoka-clifton-10': ['nike-pegasus-42', 'new-balance-880-v15'],
  'new-balance-880-v15': ['asics-gel-cumulus-28', 'brooks-ghost-17'],
  'asics-gel-nimbus-28': ['hoka-bondi-9', 'brooks-glycerin-23'],
  'hoka-bondi-9': ['asics-gel-nimbus-28', 'new-balance-more-v6'],
  'brooks-glycerin-23': ['asics-gel-nimbus-28', 'saucony-triumph-24'],
  'saucony-triumph-24': ['brooks-glycerin-23', 'nike-vomero-18'],
  'nike-vomero-18': ['asics-gel-nimbus-28', 'saucony-triumph-24'],
  'asics-gel-kayano-33': ['brooks-adrenaline-gts-25', 'nike-structure-26'],
  'brooks-adrenaline-gts-25': ['asics-gt-2000-14', 'saucony-guide-19'],
  'asics-gt-2000-14': ['brooks-adrenaline-gts-25', 'new-balance-860-v15'],
  'asics-novablast-5': ['adidas-sl-2', 'on-cloudmonster-3'],
  'adidas-sl-2': ['asics-novablast-5', 'puma-velocity-nitro-4'],
  'asics-superblast-3': ['adidas-evo-sl', 'new-balance-balos'],
  'adidas-evo-sl': ['asics-superblast-3', 'hoka-mach-7'],
  'saucony-endorphin-speed-5': ['adidas-adizero-boston-13', 'hoka-mach-x3'],
  'adidas-adizero-boston-13': ['saucony-endorphin-speed-5', 'asics-sonicblast'],
  'nike-zoomfly-6': ['asics-magic-speed-5', 'puma-deviate-nitro-4'],
  'asics-magic-speed-5': ['nike-zoomfly-6', 'saucony-endorphin-trainer'],
  'nike-vaporfly-4': ['adidas-adizero-adios-pro-4', 'asics-metaspeed-tokyo-sky'],
  'nike-alphafly-3': ['adidas-adizero-pro-evo-3', 'asics-metaspeed-tokyo-sky'],
  'adidas-adizero-adios-pro-4': ['nike-vaporfly-4', 'saucony-endorphin-pro-5'],
  'asics-metaspeed-tokyo-sky': ['nike-vaporfly-4', 'asics-metaspeed-tokyo-edge'],
  'asics-metaspeed-tokyo-edge': ['asics-metaspeed-tokyo-sky', 'nike-vaporfly-4'],
  'nike-streakfly-2': ['adidas-adizero-takumi-sen-11', 'on-cloudboom-bolt'],
  'adidas-adizero-takumi-sen-11': ['nike-streakfly-2', 'new-balance-sc-pacer-v2'],
};

/**
 * 같은 세부 카테고리 안에서 다른 브랜드 대안을 카탈로그 순서 기준으로 가장 가까운 2종 골라 줍니다.
 * 결정적(deterministic)이라 데이터가 바뀌지 않는 한 항상 같은 결과가 나옵니다.
 */
function autoComparisons(entry: ShoeEntry, group: ShoeEntry[]): string[] {
  const selfIndex = group.findIndex((item) => item.id === entry.id);
  const others = group.filter((item) => item.id !== entry.id && item.brand !== entry.brand);
  const pool = others.length > 0 ? others : group.filter((item) => item.id !== entry.id);
  return [...pool]
    .sort((left, right) => {
      const byDistance =
        Math.abs(group.indexOf(left) - selfIndex) - Math.abs(group.indexOf(right) - selfIndex);
      return byDistance !== 0 ? byDistance : left.id.localeCompare(right.id);
    })
    .slice(0, 2)
    .map((item) => item.id);
}

/** 큐레이션된 조합을 우선 쓰되, 존재하지 않는 id는 버리고 부족하면 자동 대안으로 채웁니다. */
function withComparisons(entries: ShoeEntry[]): ShoeEntry[] {
  const known = new Set(entries.map((entry) => entry.id));
  const groups = new Map<ShoeSubCategory, ShoeEntry[]>();
  for (const entry of entries) {
    const group = groups.get(entry.subCategory) ?? [];
    group.push(entry);
    groups.set(entry.subCategory, group);
  }
  return entries.map((entry) => {
    const explicit = [...(entry.comparedTo ?? []), ...(curatedComparisons[entry.id] ?? [])].filter(
      (id) => id !== entry.id && known.has(id),
    );
    const merged = Array.from(new Set(explicit)).slice(0, 2);
    if (merged.length >= 2) return { ...entry, comparedTo: merged };
    const group = groups.get(entry.subCategory) ?? [];
    for (const candidate of autoComparisons(entry, group)) {
      if (merged.length >= 2) break;
      if (!merged.includes(candidate)) merged.push(candidate);
    }
    return { ...entry, comparedTo: merged };
  });
}

export const shoeCatalog: ShoeEntry[] = withComparisons([
  ...dailyEntryShoes,
  ...dailyMaxCushionShoes,
  ...dailyStabilityShoes,
  ...dailyAllrounderShoes,
  ...dailyLightTrainerShoes,
  ...superTrainerNonPlateShoes,
  ...superTrainerLightPlateShoes,
  ...superTrainerCarbonShoes,
  ...racingShortShoes,
  ...racingLongShoes,
  ...previousGenerationShoes,
]);

export function findShoeEntry(id: string, values: ShoeEntry[] = shoeCatalog): ShoeEntry | undefined {
  return values.find((entry) => entry.id === id);
}

// ---------------------------------------------------------------------------
// 공식 스펙 표시 헬퍼
// 값이 있는 항목만 만들어 돌려줍니다. 빈칸·물음표·"미확인" 같은 자리표시자를 만들지 않아
// 화면이 없는 수치를 있는 것처럼 그리는 일을 구조적으로 막습니다.
// ---------------------------------------------------------------------------

export type ShoeSpecItem = {
  key: 'weight' | 'drop' | 'stack' | 'price';
  label: string;
  value: string;
};

/** 스펙 카드에 함께 붙이는 출처 캡션입니다. */
export const OFFICIAL_SPEC_CAPTION = '제조사 공표 기준';

/** 천 단위 구분 쉼표. Intl 없이 동작하도록 직접 만듭니다(Hermes 호환). */
export function formatKrw(value: number): string {
  return `${Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',')}원`;
}

export function officialSpecItems(entry: ShoeEntry): ShoeSpecItem[] {
  const items: ShoeSpecItem[] = [];
  if (typeof entry.weightGrams === 'number') {
    items.push({ key: 'weight', label: '무게', value: `${entry.weightGrams}g` });
  }
  if (typeof entry.dropMm === 'number') {
    items.push({ key: 'drop', label: '드롭', value: `${entry.dropMm}mm` });
  }
  if (entry.stackMm) {
    items.push({
      key: 'stack',
      label: '스택',
      value: `${entry.stackMm.heel}/${entry.stackMm.forefoot}mm`,
    });
  }
  if (typeof entry.priceKrw === 'number') {
    items.push({ key: 'price', label: '정가', value: formatKrw(entry.priceKrw) });
  }
  return items;
}

export function hasOfficialSpec(entry: ShoeEntry): boolean {
  return officialSpecItems(entry).length > 0;
}

export function shoeSearchText(entry: ShoeEntry): string {
  return `${entry.brand} ${entry.model} ${entry.modelEn}`.toLocaleLowerCase('ko-KR');
}

export const shoeCatalogInternals = {
  subCategoryDefaults,
  subCategoryGuides,
  brandFitNotes,
  curatedComparisons,
  curatedKeyTech,
  define,
  keyTechFor,
  withComparisons,
};

