// 확장 러닝화 카탈로그의 무결성과 탐색 규칙, 국내 구매 링크 안전선을 검증합니다.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SHOE_DATA_VERSION, findShoeEntry, shoeCatalog, shoes } from '../domains/shoes/catalog';
import {
  activeFilterCount,
  countByBrand,
  countByCategory,
  filterShoes,
  resetShoeFilters,
  toggleValue,
} from '../domains/shoes/filters';
import { mergeShoeCatalog } from '../domains/shoes/refresh';
import {
  BRAND_OFFICIAL_LABEL,
  COUPANG_SEARCH_LABEL,
  NAVER_SEARCH_LABEL,
  entryPurchaseLinks,
} from '../domains/shoes/purchaseLinks';
import {
  isValidSubCategory,
  shoeBrandColors,
  shoeBrands,
  shoeCategories,
  shoeDistances,
  shoeLevels,
  shoePriceBands,
} from '../domains/shoes/taxonomy';

describe('러닝화 카탈로그 무결성', () => {
  it('id가 중복되지 않는다', () => {
    const ids = shoeCatalog.map((entry) => entry.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('모든 항목이 유효한 category와 subCategory 조합을 가진다', () => {
    for (const entry of shoeCatalog) {
      assert.ok(shoeCategories.includes(entry.category), `${entry.id} category`);
      assert.ok(
        isValidSubCategory(entry.category, entry.subCategory),
        `${entry.id}: ${entry.category} > ${entry.subCategory}`,
      );
    }
  });

  it('브랜드는 등록된 10개 안에서만 쓰이고 브랜드 컬러가 일치한다', () => {
    assert.equal(shoeBrands.length, 10);
    for (const entry of shoeCatalog) {
      assert.ok(shoeBrands.includes(entry.brand), `${entry.id} brand`);
      assert.equal(entry.brandColor, shoeBrandColors[entry.brand], `${entry.id} brandColor`);
    }
  });

  it('실력·거리·가격대·플레이트 값이 모두 허용된 범위 안에 있다', () => {
    for (const entry of shoeCatalog) {
      assert.ok(entry.levels.length > 0, `${entry.id} levels`);
      assert.ok(entry.distances.length > 0, `${entry.id} distances`);
      for (const level of entry.levels) assert.ok(shoeLevels.includes(level), `${entry.id} ${level}`);
      for (const distance of entry.distances) {
        assert.ok(shoeDistances.includes(distance), `${entry.id} ${distance}`);
      }
      assert.ok(shoePriceBands.includes(entry.priceBand), `${entry.id} priceBand`);
      assert.ok(['none', 'light', 'carbon'].includes(entry.plate), `${entry.id} plate`);
    }
  });

  it('세부 카테고리와 플레이트 분류가 서로 모순되지 않는다', () => {
    for (const entry of shoeCatalog) {
      if (entry.subCategory === '카본 플레이트') assert.equal(entry.plate, 'carbon', entry.id);
      if (entry.subCategory === '라이트 플레이트') assert.equal(entry.plate, 'light', entry.id);
      if (entry.subCategory === '논 플레이트') assert.equal(entry.plate, 'none', entry.id);
    }
  });

  it('설명 필드가 비어 있지 않고 장점은 2~4개다', () => {
    for (const entry of shoeCatalog) {
      assert.ok(entry.strengths.length >= 2 && entry.strengths.length <= 4, `${entry.id} strengths`);
      assert.ok(entry.watchouts.length >= 1 && entry.watchouts.length <= 2, `${entry.id} watchouts`);
      assert.ok(entry.pick.trim().length > 0, `${entry.id} pick`);
      assert.ok(entry.model.trim().length > 0 && entry.modelEn.trim().length > 0, `${entry.id} model`);
    }
  });

  it('출처 상태를 모든 항목이 남긴다', () => {
    for (const entry of shoeCatalog) {
      assert.ok(
        entry.verification === 'chart-2026-05' || entry.verification === 'official-checked',
        `${entry.id} verification`,
      );
    }
  });

  it('추측한 수치 스펙을 필드로 하드코딩하지 않는다', () => {
    for (const entry of shoeCatalog) {
      const record = entry as unknown as Record<string, unknown>;
      for (const forbidden of ['weightGram', 'dropMm', 'stackMm', 'priceKrw', 'releaseDate']) {
        assert.equal(record[forbidden], undefined, `${entry.id}.${forbidden}`);
      }
    }
  });

  it('세 카테고리가 모두 채워져 있고 전체 개수가 100종을 넘는다', () => {
    const counts = countByCategory();
    assert.ok(shoeCatalog.length > 100, `총 ${shoeCatalog.length}종`);
    for (const category of shoeCategories) {
      assert.ok(counts[category] > 0, `${category} 비어 있음`);
    }
    assert.equal(
      counts.데일리 + counts.슈퍼트레이너 + counts.레이싱,
      shoeCatalog.length,
    );
  });

  it('브랜드 10곳이 모두 최소 한 종 이상 포함된다', () => {
    const counts = countByBrand();
    for (const brand of shoeBrands) {
      assert.ok((counts[brand] ?? 0) > 0, `${brand} 없음`);
    }
  });

  it('기존 legacy 러닝화 id가 확장 카탈로그에서도 모두 살아 있다', () => {
    for (const legacy of shoes) {
      assert.ok(findShoeEntry(legacy.id), `${legacy.id} 누락`);
    }
  });

  it('데이터 버전을 갱신해 두었다', () => {
    assert.match(SHOE_DATA_VERSION, /^\d{4}\.\d{2}\.\d{2}-v\d+$/);
  });
});

describe('러닝화 필터', () => {
  it('카테고리와 브랜드를 함께 걸면 교집합만 남는다', () => {
    const state = { ...resetShoeFilters(), category: '레이싱' as const, brands: ['Nike' as const] };
    const result = filterShoes(state);
    assert.ok(result.length > 0);
    for (const entry of result) {
      assert.equal(entry.category, '레이싱');
      assert.equal(entry.brand, 'Nike');
    }
  });

  it('실력·거리 필터는 배열 교집합(OR) 규칙을 쓴다', () => {
    const result = filterShoes({ ...resetShoeFilters(), levels: ['입문'], distances: ['풀'] });
    for (const entry of result) {
      assert.ok(entry.levels.includes('입문'));
      assert.ok(entry.distances.includes('풀'));
    }
  });

  it('플레이트 있음 필터는 none을 제외한다', () => {
    const result = filterShoes({ ...resetShoeFilters(), plates: ['any-plate'] });
    assert.ok(result.length > 0);
    for (const entry of result) assert.notEqual(entry.plate, 'none');
  });

  it('검색은 한글 모델명과 영문 모델명 모두 찾는다', () => {
    const korean = filterShoes({ ...resetShoeFilters(), query: '페가수스' });
    const english = filterShoes({ ...resetShoeFilters(), query: 'vaporfly' });
    assert.ok(korean.length > 0);
    assert.ok(english.length > 0);
    assert.ok(english.every((entry) => entry.modelEn.toLowerCase().includes('vaporfly')));
  });

  it('정렬은 결정적이며 개수를 바꾸지 않는다', () => {
    const base = resetShoeFilters();
    const byName = filterShoes({ ...base, sort: '이름순' });
    const byBrand = filterShoes({ ...base, sort: '브랜드순' });
    assert.equal(byName.length, shoeCatalog.length);
    assert.equal(byBrand.length, shoeCatalog.length);
    assert.deepEqual(
      byName.map((entry) => entry.id),
      filterShoes({ ...base, sort: '이름순' }).map((entry) => entry.id),
    );
  });

  it('초기화하면 활성 필터 수가 0이고 전체가 보인다', () => {
    const state = { ...resetShoeFilters(), query: '페가', brands: ['Nike' as const] };
    assert.equal(activeFilterCount(state), 2);
    const cleared = resetShoeFilters();
    assert.equal(activeFilterCount(cleared), 0);
    assert.equal(filterShoes(cleared).length, shoeCatalog.length);
  });

  it('toggleValue는 다중 선택을 켜고 끈다', () => {
    assert.deepEqual(toggleValue<string>([], 'a'), ['a']);
    assert.deepEqual(toggleValue(['a', 'b'], 'a'), ['b']);
  });

  it('focus된 러닝화는 결과 맨 앞으로 온다', () => {
    const target = shoeCatalog[40];
    const result = filterShoes(resetShoeFilters(), shoeCatalog, { pinnedId: target.id });
    assert.equal(result[0].id, target.id);
  });
});

describe('국내 구매 경로', () => {
  it('모든 러닝화에 네이버·쿠팡 검색 링크를 https로 제공한다', () => {
    for (const entry of shoeCatalog) {
      const links = entryPurchaseLinks(entry);
      assert.ok(links.some((link) => link.label === NAVER_SEARCH_LABEL), entry.id);
      assert.ok(links.some((link) => link.label === COUPANG_SEARCH_LABEL), entry.id);
      for (const link of links) assert.ok(link.url.startsWith('https://'), `${entry.id} ${link.url}`);
    }
  });

  it('"최저가" 같은 단정 표현을 라벨에 쓰지 않는다', () => {
    for (const entry of shoeCatalog) {
      for (const link of entryPurchaseLinks(entry)) {
        assert.ok(!link.label.includes('최저가'), `${entry.id} ${link.label}`);
      }
    }
  });

  it('국내 공식 버튼은 한국 도메인만 쓰고 없으면 아예 만들지 않는다', () => {
    const koreanHosts = ['nike.com/kr', 'adidas.co.kr', 'asics.co.kr', 'nbkorea.com'];
    for (const entry of shoeCatalog) {
      const official = entryPurchaseLinks(entry).find((link) => link.id === 'official-korea');
      if (!official) continue;
      assert.equal(official.label, BRAND_OFFICIAL_LABEL, entry.id);
      assert.ok(
        koreanHosts.some((host) => official.url.includes(host)),
        `${entry.id} ${official.url}`,
      );
    }
  });

  it('국내 공식 경로가 없는 브랜드에는 공식 버튼을 넣지 않는다', () => {
    const withoutOfficial = shoeCatalog.filter(
      (entry) => !entryPurchaseLinks(entry).some((link) => link.id === 'official-korea'),
    );
    assert.ok(withoutOfficial.length > 0);
    for (const entry of withoutOfficial) {
      assert.equal(entryPurchaseLinks(entry).length, 2, entry.id);
    }
  });
});

describe('카탈로그 갱신 훅', () => {
  it('sidecar가 없으면 번들 카탈로그를 그대로 쓴다', () => {
    const result = mergeShoeCatalog(undefined);
    assert.equal(result.entries.length, shoeCatalog.length);
    assert.equal(result.applied, 0);
  });

  it('알려진 id만 병합하고 id·brandColor는 바꾸지 않는다', () => {
    const target = shoeCatalog[0];
    const result = mergeShoeCatalog({
      version: '2026.08.01-v3',
      patches: [
        { id: target.id, pick: '갱신된 추천 문구', brandColor: '#000000' },
        { id: 'does-not-exist', pick: '무시됨' },
      ],
    });
    const merged = result.entries.find((entry) => entry.id === target.id);
    assert.equal(result.applied, 1);
    assert.equal(result.skipped, 1);
    assert.equal(merged?.pick, '갱신된 추천 문구');
    assert.equal(merged?.brandColor, target.brandColor);
    assert.equal(result.entries.length, shoeCatalog.length);
  });
});
