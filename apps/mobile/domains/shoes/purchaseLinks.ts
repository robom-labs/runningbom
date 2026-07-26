// 국내에서 실제 구매 경로를 고를 수 있도록 러닝화 외부 링크를 한곳에서 관리합니다.
import type { Shoe } from './catalog';

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
