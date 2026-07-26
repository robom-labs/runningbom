// 국내에서 실제 구매 경로를 고를 수 있도록 러닝화 외부 링크를 한곳에서 관리합니다.
//
// 규칙
// - "최저가" 같은 단정 표현을 쓰지 않습니다. 네이버/쿠팡은 검색 결과로 연결하는 "검색" 링크입니다.
// - 국내 공식은 한국 도메인의 검색/카테고리 페이지만 씁니다. 도메인이나 경로가 확실하지 않은
//   브랜드는 공식 버튼을 만들지 않습니다(해외 공식몰은 국내 구매 버튼으로 쓰지 않습니다).
// - 국내 공식 도메인이 확실하지 않은 브랜드는 도메인을 지어내는 대신 네이버 쇼핑 "브랜드 검색"으로
//   연결하고 라벨도 "브랜드 검색"으로 정직하게 표기합니다. 나중에 공식 도메인이 확인되면
//   brandSearchKoreaKeyword에서 brandOfficialKoreaUrl로 옮기기만 하면 됩니다.
import type { Shoe } from './catalog';
import type { ShoeEntry } from './catalog';
import type { ShoeBrand } from './taxonomy';

export type ShoePurchaseLink = {
  id: 'official-korea' | 'brand-search' | 'naver' | 'coupang';
  label: string;
  url: string;
};

const koreanOfficialUrls: Partial<Record<Shoe['id'], string>> = {
  'nike-pegasus-42': 'https://www.nike.com/kr/t/페가수스-42-남성-로드-러닝화-Hq1m5r/FD2722-001',
  'adidas-supernova-rise-2': 'https://www.adidas.co.kr/%EC%8A%88%ED%8D%BC%EB%85%B8%EB%B0%94-%EB%9D%BC%EC%9D%B4%EC%A6%88-2/IH2504.html',
  'asics-gel-nimbus-27': 'https://asics.co.kr/c/m-running-shoes?code=001800010001&sort=low_price',
  'new-balance-1080-v14': 'https://www.nbkorea.com/product/searchResult.action?schWord=%EB%9F%AC%EB%8B%9D',
};

function encodedSearchQuery(shoe: Shoe) {
  return encodeURIComponent(`${shoe.brand} ${shoe.model}`);
}

export function koreaPurchaseLinks(shoe: Shoe): ShoePurchaseLink[] {
  const query = encodedSearchQuery(shoe);
  const links: ShoePurchaseLink[] = [];
  const officialUrl = koreanOfficialUrls[shoe.id];
  if (officialUrl) links.push({ id: 'official-korea', label: '국내 공식몰', url: officialUrl });
  links.push({
    id: 'naver',
    label: '네이버에서 찾기',
    url: `https://search.shopping.naver.com/search/all?query=${query}`,
  });
  links.push({
    id: 'coupang',
    label: '쿠팡에서 찾기',
    url: `https://www.coupang.com/np/search?q=${query}`,
  });
  return links;
}

export function hasKoreanOfficialLink(shoe: Shoe) {
  return Boolean(koreanOfficialUrls[shoe.id]);
}

// ---------------------------------------------------------------------------
// 확장 카탈로그(ShoeEntry)용 구매 경로
// ---------------------------------------------------------------------------

export const NAVER_SEARCH_LABEL = '네이버 쇼핑 검색';
export const COUPANG_SEARCH_LABEL = '쿠팡 검색';
export const BRAND_OFFICIAL_LABEL = '브랜드 공식(국내)';
export const BRAND_SEARCH_LABEL = '브랜드 검색';

const NAVER_SHOPPING_SEARCH = 'https://search.shopping.naver.com/search/all?query=';

/**
 * 국내 공식 경로가 확인된 브랜드만 등록합니다.
 * 여기 없는 브랜드는 국내 공식 버튼을 렌더하지 않습니다(해외몰로 대체하지 않습니다).
 */
const brandOfficialKoreaUrl: Partial<Record<ShoeBrand, (query: string) => string>> = {
  Nike: (query) => `https://www.nike.com/kr/w?q=${query}`,
  adidas: (query) => `https://www.adidas.co.kr/search?q=${query}`,
  ASICS: () => 'https://asics.co.kr/c/m-running-shoes',
  'New Balance': (query) => `https://www.nbkorea.com/product/searchResult.action?schWord=${query}`,
};

/**
 * 국내 공식몰 도메인·경로를 확신할 수 없는 브랜드의 대체 경로입니다.
 * 존재하지 않는 도메인을 지어내지 않기 위해 네이버 쇼핑 브랜드 검색으로 보내고,
 * 라벨도 "브랜드 검색"이라 밝혀 공식몰인 것처럼 보이지 않게 합니다.
 * 값은 한국에서 실제로 쓰이는 브랜드 검색어입니다.
 */
const brandSearchKoreaKeyword: Partial<Record<ShoeBrand, string>> = {
  Saucony: '사우코니 러닝화',
  PUMA: '푸마 러닝화',
  HOKA: '호카 러닝화',
  Brooks: '브룩스 러닝화',
  Mizuno: '미즈노 러닝화',
  On: '온러닝 러닝화',
};

export function shoeSearchQuery(entry: ShoeEntry): string {
  return `${entry.brand} ${entry.model}`;
}

export function hasBrandOfficialKorea(entry: ShoeEntry): boolean {
  return Boolean(brandOfficialKoreaUrl[entry.brand]);
}

/** 브랜드별 국내 경로의 성격. 화면과 테스트가 "공식"과 "검색"을 구분하는 기준입니다. */
export function brandKoreaRouteKind(brand: ShoeBrand): 'official' | 'brand-search' {
  return brandOfficialKoreaUrl[brand] ? 'official' : 'brand-search';
}

/** 브랜드 단위 국내 경로 1개. 공식이 확인된 브랜드는 공식, 아니면 브랜드 검색입니다. */
export function brandKoreaLink(brand: ShoeBrand, query: string): ShoePurchaseLink | undefined {
  const official = brandOfficialKoreaUrl[brand];
  if (official) {
    return { id: 'official-korea', label: BRAND_OFFICIAL_LABEL, url: official(query) };
  }
  const keyword = brandSearchKoreaKeyword[brand];
  if (keyword) {
    return {
      id: 'brand-search',
      label: BRAND_SEARCH_LABEL,
      url: `${NAVER_SHOPPING_SEARCH}${encodeURIComponent(keyword)}`,
    };
  }
  return undefined;
}

export function entryPurchaseLinks(entry: ShoeEntry): ShoePurchaseLink[] {
  const query = encodeURIComponent(shoeSearchQuery(entry));
  const links: ShoePurchaseLink[] = [
    {
      id: 'naver',
      label: NAVER_SEARCH_LABEL,
      url: `${NAVER_SHOPPING_SEARCH}${query}`,
    },
    {
      id: 'coupang',
      label: COUPANG_SEARCH_LABEL,
      url: `https://www.coupang.com/np/search?q=${query}`,
    },
  ];
  const brandLink = brandKoreaLink(entry.brand, query);
  if (brandLink) links.push(brandLink);
  return links;
}

/** 스펙이 비어 있을 때 상세 화면이 안내로 쓰는 브랜드 경로입니다. */
export function specReferenceLink(entry: ShoeEntry): ShoePurchaseLink | undefined {
  return brandKoreaLink(entry.brand, encodeURIComponent(shoeSearchQuery(entry)));
}

export const purchaseLinkInternals = { brandOfficialKoreaUrl, brandSearchKoreaKeyword };
