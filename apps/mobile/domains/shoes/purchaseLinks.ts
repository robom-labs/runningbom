// 국내에서 실제 구매 경로를 고를 수 있도록 러닝화 외부 링크를 한곳에서 관리합니다.
//
// 규칙
// - "최저가" 같은 단정 표현을 쓰지 않습니다. 네이버/쿠팡은 검색 결과로 연결하는 "검색" 링크입니다.
// - 국내 공식은 한국 도메인의 검색/카테고리 페이지만 씁니다. 도메인이나 경로가 확실하지 않은
//   브랜드는 아예 넣지 않고 네이버/쿠팡만 제공합니다(해외 공식몰은 국내 구매 버튼으로 쓰지 않습니다).
import type { Shoe } from './catalog';
import type { ShoeEntry } from './catalog';
import type { ShoeBrand } from './taxonomy';

export type ShoePurchaseLink = {
  id: 'official-korea' | 'naver' | 'coupang';
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

export function shoeSearchQuery(entry: ShoeEntry): string {
  return `${entry.brand} ${entry.model}`;
}

export function hasBrandOfficialKorea(entry: ShoeEntry): boolean {
  return Boolean(brandOfficialKoreaUrl[entry.brand]);
}

export function entryPurchaseLinks(entry: ShoeEntry): ShoePurchaseLink[] {
  const query = encodeURIComponent(shoeSearchQuery(entry));
  const links: ShoePurchaseLink[] = [
    {
      id: 'naver',
      label: NAVER_SEARCH_LABEL,
      url: `https://search.shopping.naver.com/search/all?query=${query}`,
    },
    {
      id: 'coupang',
      label: COUPANG_SEARCH_LABEL,
      url: `https://www.coupang.com/np/search?q=${query}`,
    },
  ];
  const official = brandOfficialKoreaUrl[entry.brand];
  if (official) {
    links.push({ id: 'official-korea', label: BRAND_OFFICIAL_LABEL, url: official(query) });
  }
  return links;
}

export const purchaseLinkInternals = { brandOfficialKoreaUrl };
