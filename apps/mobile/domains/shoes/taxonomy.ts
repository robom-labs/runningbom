// 러닝화 분류 체계(카테고리·세부 카테고리·브랜드·실력·거리·가격대·플레이트) 단일 정의입니다.
// 여기서 정의한 값 이외의 문자열은 카탈로그에 들어갈 수 없도록 타입으로 강제합니다.

export type ShoeCategory = '데일리' | '슈퍼트레이너' | '레이싱';

export type ShoeSubCategory =
  | '입문화'
  | '맥스 쿠션화'
  | '안정화'
  | '올라운더'
  | '경량 트레이너'
  | '논 플레이트'
  | '라이트 플레이트'
  | '카본 플레이트'
  | '중거리'
  | '장거리';

export type ShoePlate = 'none' | 'light' | 'carbon';
export type ShoeLevel = '입문' | '중급' | '상급';
export type ShoeDistance = '단거리' | '5K' | '10K' | '하프' | '풀' | '장거리조깅';
export type ShoePriceBand = '엔트리' | '미들' | '하이' | '프리미엄';
export type ShoePurposeTag =
  | '데일리조깅'
  | '장거리'
  | '스피드훈련'
  | '대회레이스'
  | '회복주'
  | '안정지지';

/** 데이터 출처 상태. 기본값은 2026-05 러닝화 분류 차트 기반이라는 뜻입니다. */
export type ShoeVerification = 'chart-2026-05' | 'official-checked';

export const shoeCategories: readonly ShoeCategory[] = ['데일리', '슈퍼트레이너', '레이싱'];

/** 카테고리별로 허용되는 세부 카테고리. 카탈로그 무결성 검사의 기준입니다. */
export const shoeSubCategories: Readonly<Record<ShoeCategory, readonly ShoeSubCategory[]>> = {
  데일리: ['입문화', '맥스 쿠션화', '안정화', '올라운더', '경량 트레이너'],
  슈퍼트레이너: ['논 플레이트', '라이트 플레이트', '카본 플레이트'],
  레이싱: ['중거리', '장거리'],
};

export const shoeLevels: readonly ShoeLevel[] = ['입문', '중급', '상급'];
export const shoeDistances: readonly ShoeDistance[] = [
  '단거리',
  '5K',
  '10K',
  '하프',
  '풀',
  '장거리조깅',
];
export const shoePriceBands: readonly ShoePriceBand[] = ['엔트리', '미들', '하이', '프리미엄'];
export const shoePurposeTags: readonly ShoePurposeTag[] = [
  '데일리조깅',
  '장거리',
  '스피드훈련',
  '대회레이스',
  '회복주',
  '안정지지',
];

export const shoeBrands = [
  'Nike',
  'adidas',
  'ASICS',
  'New Balance',
  'Saucony',
  'PUMA',
  'HOKA',
  'Brooks',
  'Mizuno',
  'On',
] as const;

export type ShoeBrand = (typeof shoeBrands)[number];

/**
 * 카드/상세의 액센트로만 쓰는 앱 자체 색상입니다.
 * 브랜드 공식 색상 자산이나 로고를 대신하지 않으며, 제품 이미지는 사용하지 않습니다.
 */
export const shoeBrandColors: Readonly<Record<ShoeBrand, string>> = {
  Nike: '#1C1C1E',
  adidas: '#1B2A5E',
  ASICS: '#1E63C9',
  'New Balance': '#C1121F',
  Saucony: '#D2551B',
  PUMA: '#1B7A44',
  HOKA: '#0E7C86',
  Brooks: '#6B3FA0',
  Mizuno: '#0B4F72',
  On: '#39424E',
};

/** 이미지 대신 쓰는 카드 액센트 이니셜입니다. */
export const shoeBrandInitials: Readonly<Record<ShoeBrand, string>> = {
  Nike: 'NK',
  adidas: 'AD',
  ASICS: 'AS',
  'New Balance': 'NB',
  Saucony: 'SC',
  PUMA: 'PM',
  HOKA: 'HK',
  Brooks: 'BR',
  Mizuno: 'MZ',
  On: 'ON',
};

export const shoePlateLabels: Readonly<Record<ShoePlate, string>> = {
  none: '플레이트 없음',
  light: '라이트 플레이트',
  carbon: '카본 플레이트',
};

export const shoePriceBandLabels: Readonly<Record<ShoePriceBand, string>> = {
  엔트리: '엔트리 가격대',
  미들: '미들 가격대',
  하이: '하이 가격대',
  프리미엄: '프리미엄 가격대',
};

export const shoeVerificationLabels: Readonly<Record<ShoeVerification, string>> = {
  'chart-2026-05': '2026-05 러닝화 분류 차트 기반',
  'official-checked': '브랜드 공식 페이지 확인',
};

export function isValidSubCategory(
  category: ShoeCategory,
  subCategory: ShoeSubCategory,
): boolean {
  return shoeSubCategories[category].includes(subCategory);
}
