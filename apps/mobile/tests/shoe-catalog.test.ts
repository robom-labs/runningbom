// 확장 러닝화 카탈로그의 무결성과 탐색 규칙, 국내 구매 링크 안전선을 검증합니다.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  SHOE_DATA_VERSION,
  findShoeEntry,
  shoeCatalog,
  shoeCatalogInternals,
  shoes,
} from '../domains/shoes/catalog';
import {
  ADVISOR_MAX_PER_BRAND,
  ADVISOR_MAX_RESULTS,
  ADVISOR_MIN_RESULTS,
  OVER_BUDGET_NOTE,
  advisorQuestions,
  recommendShoeEntries,
  type AdvisorAnswers,
} from '../domains/shoes/advisor';
import {
  COMPARE_MAX,
  buildComparisonRows,
  canCompare,
  compareHighlights,
  resolveCompareShoes,
  toggleCompareId,
} from '../domains/shoes/compare';
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

describe('구매 결정용 심화 정보', () => {
  it('모든 항목이 useCase·fitNote·bestForRunner·notFor를 채운다', () => {
    for (const entry of shoeCatalog) {
      assert.ok(entry.useCase.trim().length >= 30, `${entry.id} useCase`);
      assert.ok(entry.fitNote.trim().length >= 20, `${entry.id} fitNote`);
      assert.ok(entry.bestForRunner.length >= 1, `${entry.id} bestForRunner`);
      assert.ok(entry.notFor.length >= 1, `${entry.id} notFor`);
      for (const line of [...entry.bestForRunner, ...entry.notFor]) {
        assert.ok(line.trim().length > 0, `${entry.id} 빈 줄`);
      }
    }
  });

  it('fitNote는 단정 대신 완충 표현을 쓰고 매장 착화를 권한다', () => {
    for (const entry of shoeCatalog) {
      assert.ok(entry.fitNote.includes('매장 착화'), `${entry.id} 매장 착화 권고 없음`);
      assert.ok(
        entry.fitNote.includes('알려져 있어요') || entry.fitNote.includes('평이 있어요'),
        `${entry.id} 완충 표현 없음`,
      );
      for (const forbidden of ['반드시', '무조건', '최저가']) {
        assert.ok(!entry.fitNote.includes(forbidden), `${entry.id} 단정 표현 ${forbidden}`);
      }
    }
  });

  it('useCase는 거리와 실력 정보를 함께 담는다', () => {
    for (const entry of shoeCatalog) {
      assert.ok(entry.useCase.includes(entry.distances[0]), `${entry.id} 거리 누락`);
      assert.ok(entry.useCase.includes(entry.levels[0]), `${entry.id} 실력 누락`);
    }
  });

  it('comparedTo는 실제 존재하는 다른 id만 1~2개 가리킨다', () => {
    const ids = new Set(shoeCatalog.map((entry) => entry.id));
    for (const entry of shoeCatalog) {
      assert.ok(
        entry.comparedTo.length >= 1 && entry.comparedTo.length <= 2,
        `${entry.id} comparedTo 개수 ${entry.comparedTo.length}`,
      );
      assert.equal(new Set(entry.comparedTo).size, entry.comparedTo.length, `${entry.id} 중복`);
      for (const other of entry.comparedTo) {
        assert.ok(ids.has(other), `${entry.id} → ${other} 끊어진 참조`);
        assert.notEqual(other, entry.id, `${entry.id} 자기 자신 참조`);
      }
    }
  });

  it('큐레이션한 비교 조합의 id가 모두 카탈로그에 있다', () => {
    const ids = new Set(shoeCatalog.map((entry) => entry.id));
    for (const [id, others] of Object.entries(shoeCatalogInternals.curatedComparisons)) {
      assert.ok(ids.has(id), `큐레이션 기준 id 없음: ${id}`);
      for (const other of others) assert.ok(ids.has(other), `${id} → ${other} 없음`);
    }
  });

  it('comparedTo는 되도록 같은 세부 카테고리 안에서 연결한다', () => {
    const byId = new Map(shoeCatalog.map((entry) => [entry.id, entry] as const));
    for (const entry of shoeCatalog) {
      for (const other of entry.comparedTo) {
        assert.equal(byId.get(other)?.subCategory, entry.subCategory, `${entry.id} → ${other}`);
      }
    }
  });

  it('keyTech는 확인된 항목에만 있고 빈 문자열을 넣지 않는다', () => {
    let filled = 0;
    for (const entry of shoeCatalog) {
      assert.ok(Array.isArray(entry.keyTech), `${entry.id} keyTech`);
      for (const tech of entry.keyTech) assert.ok(tech.trim().length > 0, `${entry.id} 빈 keyTech`);
      assert.equal(new Set(entry.keyTech).size, entry.keyTech.length, `${entry.id} keyTech 중복`);
      if (entry.keyTech.length > 0) filled += 1;
    }
    // 모르는 항목은 비워 두는 것이 정답이라 100% 채워질 수 없습니다.
    assert.ok(filled > 0 && filled < shoeCatalog.length, `keyTech 채움 ${filled}`);
  });

  it('심화 문구 어디에도 "최저가" 같은 금지 표현이 없다', () => {
    for (const entry of shoeCatalog) {
      const blob = [
        entry.useCase,
        entry.fitNote,
        entry.pick,
        ...entry.bestForRunner,
        ...entry.notFor,
        ...entry.strengths,
        ...entry.watchouts,
        ...entry.keyTech,
      ].join(' ');
      for (const forbidden of ['최저가', '해외직구', '병행수입']) {
        assert.ok(!blob.includes(forbidden), `${entry.id} 금지 표현 ${forbidden}`);
      }
    }
  });
});

describe('러닝화 추천 마법사', () => {
  const beginner: AdvisorAnswers = {
    experience: '입문',
    goal: '건강조깅',
    distance: '10K',
    budget: '미들',
  };
  const racer: AdvisorAnswers = {
    experience: '1년이상',
    goal: '대회준비',
    distance: '하프이상',
    budget: '상관없음',
  };

  it('질문은 3~4개이고 모두 선택지를 가진다', () => {
    assert.ok(advisorQuestions.length >= 3 && advisorQuestions.length <= 4);
    for (const question of advisorQuestions) {
      assert.ok(question.options.length >= 2, question.key);
      assert.equal(new Set(question.options.map((option) => option.value)).size, question.options.length);
    }
  });

  it('입문자에게는 레이싱 대회화와 카본 플레이트를 추천하지 않는다', () => {
    const results = recommendShoeEntries(beginner);
    assert.ok(results.length >= ADVISOR_MIN_RESULTS);
    for (const result of results) {
      assert.notEqual(result.shoe.category, '레이싱', result.shoe.id);
      assert.notEqual(result.shoe.plate, 'carbon', result.shoe.id);
    }
  });

  it('예산 밴드 안의 러닝화가 항상 예산 초과 후보보다 먼저 온다', () => {
    const results = recommendShoeEntries({ ...beginner, budget: '엔트리' });
    const firstOver = results.findIndex((result) => result.overBudget);
    if (firstOver >= 0) {
      for (const result of results.slice(firstOver)) {
        assert.equal(result.overBudget, true, `${result.shoe.id} 순서 역전`);
      }
    }
    for (const result of results) {
      if (result.overBudget) {
        assert.notEqual(result.shoe.priceBand, '엔트리', result.shoe.id);
        assert.ok(result.reason.includes(OVER_BUDGET_NOTE), `${result.shoe.id} 예산 안내 누락`);
      } else {
        assert.equal(result.shoe.priceBand, '엔트리', result.shoe.id);
      }
    }
  });

  it('대회 준비 답변은 대회·슈퍼트레이너 성격을 우선 고른다', () => {
    const results = recommendShoeEntries(racer);
    assert.ok(results.length >= ADVISOR_MIN_RESULTS);
    for (const result of results) {
      assert.ok(
        result.shoe.category === '레이싱' ||
          result.shoe.category === '슈퍼트레이너' ||
          result.shoe.purposeTags.includes('대회레이스'),
        result.shoe.id,
      );
    }
  });

  it('추천 거리 조건이 답변한 거리와 겹친다', () => {
    for (const result of recommendShoeEntries({ ...beginner, distance: '5K이하' })) {
      assert.ok(
        result.shoe.distances.some((distance) => distance === '단거리' || distance === '5K'),
        result.shoe.id,
      );
    }
  });

  it('결과는 5~8종이고 한 브랜드가 3종 이상 차지하지 않는다', () => {
    for (const answers of [beginner, racer]) {
      const results = recommendShoeEntries(answers);
      assert.ok(results.length >= ADVISOR_MIN_RESULTS && results.length <= ADVISOR_MAX_RESULTS);
      const counts: Record<string, number> = {};
      for (const result of results) counts[result.shoe.brand] = (counts[result.shoe.brand] ?? 0) + 1;
      for (const [brand, count] of Object.entries(counts)) {
        assert.ok(count <= ADVISOR_MAX_PER_BRAND, `${brand} ${count}종`);
      }
    }
  });

  it('모든 추천에 한 줄 근거가 붙고 결과가 결정적이다', () => {
    const first = recommendShoeEntries(racer);
    const second = recommendShoeEntries(racer);
    assert.deepEqual(
      first.map((result) => result.shoe.id),
      second.map((result) => result.shoe.id),
    );
    for (const result of first) {
      assert.ok(result.reason.trim().length > 0, result.shoe.id);
      assert.ok(!result.reason.includes('최저가'), result.shoe.id);
    }
  });

  it('점수는 조건이 더 맞을수록 높다', () => {
    const results = recommendShoeEntries(beginner);
    for (let index = 1; index < results.length; index += 1) {
      assert.ok(results[index - 1].score >= results[index].score, `${index} 정렬 역전`);
    }
  });
});

describe('러닝화 나란히 비교', () => {
  it('비교함은 최대 3켤레까지만 담긴다', () => {
    let ids: string[] = [];
    for (const entry of shoeCatalog.slice(0, 5)) ids = toggleCompareId(ids, entry.id);
    assert.equal(ids.length, COMPARE_MAX);
    ids = toggleCompareId(ids, ids[0]);
    assert.equal(ids.length, COMPARE_MAX - 1);
  });

  it('2켤레 미만이면 비교를 열 수 없다', () => {
    assert.equal(canCompare([]), false);
    assert.equal(canCompare([shoeCatalog[0].id]), false);
    assert.equal(canCompare([shoeCatalog[0].id, shoeCatalog[1].id]), true);
  });

  it('없는 id는 조용히 버리고 남은 것만 비교한다', () => {
    const resolved = resolveCompareShoes([shoeCatalog[0].id, 'does-not-exist']);
    assert.equal(resolved.length, 1);
    assert.equal(resolved[0].id, shoeCatalog[0].id);
  });

  it('비교표는 모든 행이 선택한 켤레 수만큼 값을 가진다', () => {
    const picked = [shoeCatalog[0], shoeCatalog[1], shoeCatalog[2]];
    const rows = buildComparisonRows(picked);
    assert.ok(rows.length >= 8);
    for (const row of rows) {
      assert.equal(row.values.length, picked.length, row.label);
      for (const value of row.values) assert.ok(value.trim().length > 0, `${row.label} 빈 값`);
    }
    // 수치 스펙 열을 만들지 않습니다.
    for (const forbidden of ['무게', '드롭', '스택', '원']) {
      assert.ok(!rows.some((row) => row.label.includes(forbidden)), forbidden);
    }
  });

  it('비교 요약은 가격 안내 문구를 항상 포함한다', () => {
    const highlights = compareHighlights([shoeCatalog[0], shoeCatalog[1]]);
    assert.ok(highlights.length > 0);
    assert.ok(highlights.some((line) => line.includes('밴드 구간')));
    assert.ok(!highlights.some((line) => line.includes('최저가')));
  });
});
