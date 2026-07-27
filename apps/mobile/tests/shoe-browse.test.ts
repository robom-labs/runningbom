// 러닝화 "안내된 탐색" 골격(큰 갈래 → 세부 갈래 → 목록)과 거리별·실력별 진입을 검증합니다.
// 화면 문구에 개수를 하드코딩하지 않았는지, 업계 용어에 설명을 붙였는지도 여기서 지킵니다.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  allowsFullFilters,
  countCategoryShoes,
  countDistanceShoes,
  countLevelShoes,
  countSubCategoryShoes,
  filtersForSource,
  shoeBrowseBack,
  shoeBrowseBackLabel,
  shoeCategoryGuide,
  shoeCategoryGuides,
  shoeDistanceEntries,
  shoeGlossary,
  shoeLevelEntries,
  shoeListLead,
  shoeListTitle,
  shoeRouteToView,
  shoeSubCategoryGuides,
  shoeSubCategoryGuidesOf,
} from '../domains/shoes/browse';
import { officialSpecItems, shoeCatalog } from '../domains/shoes/catalog';
import {
  activeFilterDimensions,
  clearFilterDimension,
  emptyResultAdvice,
  filterShoes,
  resetShoeFilters,
  shoeSorts,
} from '../domains/shoes/filters';
import {
  shoeCategories,
  shoeDistances,
  shoeLevels,
  shoePriceBands,
  shoeSubCategories,
} from '../domains/shoes/taxonomy';

/** 회장 지침에서 쓰지 말라고 정한 말들입니다. */
const FORBIDDEN_WORDS = ['스트릭', 'RPE', '인터벌', '템포런', '세션'];

/** 안내 문구 전부(설명 성격의 문장만). 제목은 짧게 두므로 제외합니다. */
function guideProse(): string[] {
  return [
    ...shoeCategoryGuides.flatMap((guide) => [guide.forWhom, guide.termNote]),
    ...shoeSubCategoryGuides.map((guide) => guide.forWhom),
    ...shoeDistanceEntries.map((entry) => entry.lead),
    ...shoeLevelEntries.map((entry) => entry.lead),
  ];
}

describe('러닝화 큰 갈래(1단계)', () => {
  it('taxonomy의 세 갈래를 빠짐없이 그대로 승격시킨다', () => {
    assert.equal(shoeCategoryGuides.length, shoeCategories.length);
    for (const category of shoeCategories) {
      const guide = shoeCategoryGuide(category);
      assert.equal(guide.category, category);
      assert.ok(guide.title.trim().length > 0, category);
    }
  });

  it('각 갈래에 "어떤 사람에게 맞는지" 한 줄과 용어 설명이 있다', () => {
    for (const guide of shoeCategoryGuides) {
      assert.ok(guide.forWhom.includes('맞아요'), guide.category);
      assert.ok(guide.termNote.includes('('), guide.category);
      assert.ok(guide.termNote.includes(')'), guide.category);
    }
  });

  it('갈래별 개수 합이 카탈로그 전체와 같다(개수를 지어내지 않는다)', () => {
    const total = shoeCategories.reduce((sum, category) => sum + countCategoryShoes(category), 0);
    assert.equal(total, shoeCatalog.length);
    for (const category of shoeCategories) {
      assert.ok(countCategoryShoes(category) > 0, category);
    }
  });
});

describe('러닝화 세부 갈래(2단계)', () => {
  it('taxonomy가 허용한 조합을 하나도 빠뜨리지 않고 순서까지 따른다', () => {
    for (const category of shoeCategories) {
      const guides = shoeSubCategoryGuidesOf(category);
      assert.deepEqual(
        guides.map((guide) => guide.subCategory),
        [...shoeSubCategories[category]],
      );
      for (const guide of guides) {
        assert.ok(guide.title.trim().length > 0, guide.subCategory);
        assert.ok(guide.forWhom.trim().length >= 10, guide.subCategory);
      }
    }
  });

  it('세부 갈래 개수 합이 그 갈래 개수와 같고 빈 갈래가 없다', () => {
    for (const category of shoeCategories) {
      let sum = 0;
      for (const sub of shoeSubCategories[category]) {
        const count = countSubCategoryShoes(category, sub);
        assert.ok(count > 0, `${category} > ${sub} 비어 있음`);
        sum += count;
      }
      assert.equal(sum, countCategoryShoes(category), category);
    }
  });
});

describe('거리별 진입', () => {
  it('5km 이하 / 10km / 하프 / 풀 / 매일 조깅 다섯 갈래를 둔다', () => {
    assert.equal(shoeDistanceEntries.length, 5);
    assert.deepEqual(
      shoeDistanceEntries.map((entry) => entry.key),
      ['5km이하', '10km', '하프', '풀', '매일조깅'],
    );
  });

  it('taxonomy의 거리값을 전부 덮고, 없는 값을 만들지 않는다', () => {
    const used = new Set(shoeDistanceEntries.flatMap((entry) => entry.distances));
    for (const distance of shoeDistances) assert.ok(used.has(distance), distance);
    for (const distance of used) assert.ok(shoeDistances.includes(distance), distance);
  });

  it('거리마다 한 줄 설명이 있고 실제로 결과가 나온다', () => {
    for (const entry of shoeDistanceEntries) {
      assert.ok(entry.lead.trim().length >= 15, entry.key);
      const count = countDistanceShoes(entry.key);
      assert.ok(count > 0, `${entry.key} 0종`);
      // 진입 조건을 필터로 옮겼을 때 실측 개수와 정확히 같아야 합니다.
      assert.equal(filterShoes(filtersForSource({ type: 'distance', key: entry.key })).length, count);
    }
  });
});

describe('실력별 진입', () => {
  it('taxonomy의 실력값 셋을 그대로 쓰되 라벨은 부담 없는 말로 바꾼다', () => {
    assert.equal(shoeLevelEntries.length, shoeLevels.length);
    for (const entry of shoeLevelEntries) {
      assert.ok(shoeLevels.includes(entry.level), entry.level);
      // "상급" 같은 등급 표현을 화면 라벨로 그대로 쓰지 않습니다.
      for (const level of shoeLevels) {
        assert.ok(!entry.label.includes(level), `${entry.level} 라벨에 등급 표현 ${level}`);
      }
      assert.ok(entry.lead.trim().length >= 15, entry.level);
    }
    assert.deepEqual(
      shoeLevelEntries.map((entry) => entry.label),
      ['이제 시작해요', '꾸준히 뛰어요', '기록을 노려요'],
    );
  });

  it('실력마다 결과가 있고 진입 필터가 실측 개수와 일치한다', () => {
    for (const entry of shoeLevelEntries) {
      const count = countLevelShoes(entry.level);
      assert.ok(count > 0, entry.level);
      assert.equal(filterShoes(filtersForSource({ type: 'level', level: entry.level })).length, count);
    }
  });
});

describe('안내 문구 용어 규칙', () => {
  it('쓰지 말라고 정한 말이 안내 문구에 없다', () => {
    for (const line of guideProse()) {
      for (const word of FORBIDDEN_WORDS) {
        assert.ok(!line.includes(word), `${word} 사용: ${line}`);
      }
    }
  });

  it('플레이트·드롭·스택을 쓰면 반드시 괄호 설명을 붙인다', () => {
    for (const line of guideProse()) {
      for (const term of ['플레이트', '드롭', '스택']) {
        if (!line.includes(term)) continue;
        assert.ok(line.includes(`${term}(`), `${term} 설명 없음: ${line}`);
      }
    }
  });

  it('"슈퍼 트레이너" 같은 업계 용어는 갈래 카드에서 한 줄로 풀어 준다', () => {
    const guide = shoeCategoryGuide('슈퍼트레이너');
    assert.ok(guide.termNote.includes('슈퍼 트레이너('), guide.termNote);
    assert.equal(guide.termNote, shoeGlossary.슈퍼트레이너);
  });

  it('상세의 공식 스펙 라벨도 용어를 풀어 쓴다', () => {
    const withDrop = shoeCatalog.find((entry) => typeof entry.dropMm === 'number');
    assert.ok(withDrop, '드롭이 채워진 항목이 없습니다');
    const labels = officialSpecItems(withDrop!).map((item) => item.label);
    assert.ok(labels.some((label) => label.includes('드롭(')), labels.join(','));
    const withStack = shoeCatalog.find((entry) => Boolean(entry.stackMm));
    if (withStack) {
      assert.ok(
        officialSpecItems(withStack).some((item) => item.label.includes('스택(')),
        withStack.id,
      );
    }
  });
});

describe('3단계 이동과 뒤로 가기', () => {
  it('세부 갈래 목록에서는 그 갈래 화면으로, 갈래 화면에서는 첫 화면으로 돌아간다', () => {
    const list = {
      kind: 'list' as const,
      source: { type: 'sub' as const, category: '데일리' as const, subCategory: '입문화' as const },
    };
    const category = shoeBrowseBack(list);
    assert.deepEqual(category, { kind: 'category', category: '데일리' });
    assert.deepEqual(shoeBrowseBack(category), { kind: 'home' });
    assert.deepEqual(shoeBrowseBack({ kind: 'home' }), { kind: 'home' });
  });

  it('거리·실력·전체 목록은 첫 화면으로 바로 돌아간다', () => {
    assert.deepEqual(
      shoeBrowseBack({ kind: 'list', source: { type: 'distance', key: '하프' } }),
      { kind: 'home' },
    );
    assert.deepEqual(shoeBrowseBack({ kind: 'list', source: { type: 'all' } }), { kind: 'home' });
  });

  it('뒤로 가기 라벨이 어디로 가는지 알려 준다', () => {
    assert.equal(
      shoeBrowseBackLabel({
        kind: 'list',
        source: { type: 'sub', category: '레이싱', subCategory: '장거리' },
      }),
      '레이싱화로',
    );
    assert.equal(shoeBrowseBackLabel({ kind: 'list', source: { type: 'all' } }), '처음으로');
  });

  it('검색·상세 필터는 전체 보기에서만 연다', () => {
    assert.equal(allowsFullFilters({ type: 'all' }), true);
    assert.equal(allowsFullFilters({ type: 'distance', key: '10km' }), false);
    assert.equal(allowsFullFilters({ type: 'level', level: '입문' }), false);
    assert.equal(
      allowsFullFilters({ type: 'sub', category: '데일리', subCategory: '안정화' }),
      false,
    );
  });

  it('목록마다 제목과 한 줄 안내가 비어 있지 않다', () => {
    const sources = [
      { type: 'all' as const },
      { type: 'category' as const, category: '데일리' as const },
      { type: 'sub' as const, category: '슈퍼트레이너' as const, subCategory: '카본 플레이트' as const },
      { type: 'distance' as const, key: '풀' as const },
      { type: 'level' as const, level: '상급' as const },
    ];
    for (const source of sources) {
      assert.ok(shoeListTitle(source).trim().length > 0, source.type);
      assert.ok(shoeListLead(source).trim().length >= 10, source.type);
    }
  });

  it('라우터가 넘긴 조각으로 단계를 지정할 수 있고 모르는 값은 첫 화면이 된다', () => {
    assert.deepEqual(shoeRouteToView('레이싱'), { kind: 'category', category: '레이싱' });
    assert.deepEqual(shoeRouteToView('all'), { kind: 'list', source: { type: 'all' } });
    assert.deepEqual(shoeRouteToView('하프'), { kind: 'list', source: { type: 'distance', key: '하프' } });
    assert.deepEqual(shoeRouteToView('입문'), { kind: 'list', source: { type: 'level', level: '입문' } });
    assert.deepEqual(shoeRouteToView('없는값'), { kind: 'home' });
    assert.deepEqual(shoeRouteToView(), { kind: 'home' });
  });

  it('진입 필터는 정렬만 이어받고 나머지는 항상 새로 만든다', () => {
    const state = filtersForSource(
      { type: 'sub', category: '데일리', subCategory: '맥스 쿠션화' },
      '이름순',
    );
    assert.equal(state.sort, '이름순');
    assert.equal(state.category, '데일리');
    assert.deepEqual(state.subCategories, ['맥스 쿠션화']);
    assert.equal(state.query, '');
    assert.deepEqual(state.brands, []);
    assert.equal(filterShoes(state).length, countSubCategoryShoes('데일리', '맥스 쿠션화'));
  });
});

describe('정렬과 빈 상태', () => {
  it('가격대 낮은 순·높은 순을 제공하고 개수를 바꾸지 않는다', () => {
    assert.ok(shoeSorts.includes('가격대 낮은 순'));
    assert.ok(shoeSorts.includes('가격대 높은 순'));
    const base = resetShoeFilters();
    const cheap = filterShoes({ ...base, sort: '가격대 낮은 순' });
    const pricey = filterShoes({ ...base, sort: '가격대 높은 순' });
    assert.equal(cheap.length, shoeCatalog.length);
    assert.equal(pricey.length, shoeCatalog.length);
    const order = (band: (typeof shoePriceBands)[number]) => shoePriceBands.indexOf(band);
    for (let index = 1; index < cheap.length; index += 1) {
      assert.ok(order(cheap[index - 1].priceBand) <= order(cheap[index].priceBand), `낮은 순 ${index}`);
      assert.ok(order(pricey[index - 1].priceBand) >= order(pricey[index].priceBand), `높은 순 ${index}`);
    }
  });

  it('정렬 결과는 결정적이다', () => {
    const base = { ...resetShoeFilters(), sort: '가격대 낮은 순' as const };
    assert.deepEqual(
      filterShoes(base).map((entry) => entry.id),
      filterShoes(base).map((entry) => entry.id),
    );
  });

  it('켜져 있는 필터 축을 화면 순서대로 알려 준다', () => {
    const state = {
      ...resetShoeFilters(),
      query: '페가',
      category: '데일리' as const,
      brands: ['Nike' as const],
    };
    assert.deepEqual(activeFilterDimensions(state), ['query', 'category', 'brands']);
    assert.deepEqual(activeFilterDimensions(resetShoeFilters()), []);
  });

  it('갈래를 풀면 그 갈래에서만 쓰던 세부 갈래도 함께 풀린다', () => {
    const state = {
      ...resetShoeFilters(),
      category: '데일리' as const,
      subCategories: ['안정화' as const],
    };
    const cleared = clearFilterDimension(state, 'category');
    assert.equal(cleared.category, undefined);
    assert.deepEqual(cleared.subCategories, []);
  });

  it('0건이면 어떤 조건 하나를 풀면 몇 종이 나오는지 알려 준다', () => {
    const state = {
      ...resetShoeFilters(),
      query: '존재하지않는모델명',
      brands: ['Nike' as const],
    };
    assert.equal(filterShoes(state).length, 0);
    const advice = emptyResultAdvice(state);
    assert.ok(advice, '제안이 없습니다');
    assert.equal(advice!.dimension, 'query');
    assert.ok(advice!.count > 0);
    assert.equal(filterShoes(clearFilterDimension(state, advice!.dimension)).length, advice!.count);
  });

  it('하나만 풀어도 결과가 없으면 제안하지 않는다(억지 제안 금지)', () => {
    const state = { ...resetShoeFilters(), query: '존재하지않는모델명' };
    // 유일한 조건을 풀면 전체가 나오므로 제안이 있어야 합니다.
    assert.equal(emptyResultAdvice(state)?.count, shoeCatalog.length);
    // 조건이 하나도 없는데 0건일 수는 없으므로 제안도 없습니다.
    assert.equal(emptyResultAdvice(resetShoeFilters(), []), undefined);
  });
});
