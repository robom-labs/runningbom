// 러닝화 그림과 순위 규칙을 검증합니다.
//
// 그림에서 보는 것: **종류가 다르면 그림도 달라지는가.**
//   전부 똑같이 생긴 그림이라면 그릴 이유가 없습니다. 글자만 있는 목록과 같습니다.
//
// 순위에서 보는 것: **근거를 밝히는가, 그리고 값이 안 보이는 줄이 없는가.**
import assert from 'node:assert/strict';
import test from 'node:test';

import { SHOE_ART_CAPTION, shiftColor, shoeArtSpec } from '../domains/shoes/art';
import { shoeCatalog } from '../domains/shoes/catalog';
import { priceDisplay } from '../domains/shoes/price';
import {
  RANKING_DISCLOSURE,
  rankDelta,
  rankDeltaLabel,
  rankShoes,
  rankingCriteria,
} from '../domains/shoes/ranking';

const now = new Date('2026-07-27T00:00:00Z');

// ── 그림 ───────────────────────────────────────────────────────────────────

test('맥스 쿠션화가 경량 트레이너보다 밑창이 두껍습니다', () => {
  // 이게 안 지켜지면 카드를 훑어도 종류가 구분되지 않습니다.
  const cushion = shoeArtSpec({
    subCategory: '맥스 쿠션화',
    plate: 'none',
    brandColor: '#334455',
  });
  const light = shoeArtSpec({
    subCategory: '경량 트레이너',
    plate: 'none',
    brandColor: '#334455',
  });
  assert.ok(cushion.midsole > light.midsole);
});

test('대회용이 입문화보다 앞코가 크게 들립니다', () => {
  const racing = shoeArtSpec({ subCategory: '장거리', plate: 'carbon', brandColor: '#334455' });
  const entry = shoeArtSpec({ subCategory: '입문화', plate: 'none', brandColor: '#334455' });
  assert.ok(racing.toeSpring > entry.toeSpring);
});

test('안정화가 가장 넓게 깔립니다', () => {
  const stability = shoeArtSpec({ subCategory: '안정화', plate: 'none', brandColor: '#334455' });
  for (const sub of ['입문화', '올라운더', '중거리'] as const) {
    const other = shoeArtSpec({ subCategory: sub, plate: 'none', brandColor: '#334455' });
    assert.ok(stability.baseWidth >= other.baseWidth, `${sub}보다 좁습니다`);
  }
});

test('세 층의 색이 서로 다릅니다', () => {
  // 같은 색이면 층이 붙어 보여서 도형 하나로 보입니다.
  const spec = shoeArtSpec({ subCategory: '올라운더', plate: 'none', brandColor: '#F26B3A' });
  assert.notEqual(spec.upperColor, spec.midsoleColor);
  assert.notEqual(spec.upperColor, spec.outsoleColor);
  assert.notEqual(spec.midsoleColor, spec.outsoleColor);
});

test('같은 신발이면 언제나 같은 그림이 나옵니다', () => {
  const shoe = shoeCatalog[0];
  assert.deepEqual(shoeArtSpec(shoe), shoeArtSpec(shoe));
});

test('카탈로그 전체가 그려집니다', () => {
  for (const shoe of shoeCatalog) {
    const spec = shoeArtSpec(shoe);
    assert.ok(spec.midsole > 0, `${shoe.id}의 밑창 두께가 0입니다`);
    assert.ok(spec.laces >= 4);
  }
});

test('색 밝기 조절이 범위를 벗어나지 않습니다', () => {
  assert.equal(shiftColor('#000000', 1), '#ffffff');
  assert.equal(shiftColor('#ffffff', -1), '#000000');
  // 알 수 없는 값이면 그대로 둡니다. 색을 망가뜨리느니 그대로가 낫습니다.
  assert.equal(shiftColor('bad', 0.5), 'bad');
});

test('그림에는 사진이 아니라는 캡션이 붙습니다', () => {
  assert.match(SHOE_ART_CAPTION, /실제 제품과 달라요/);
});

// ── 순위 ───────────────────────────────────────────────────────────────────

test('순위 산식의 비중 합이 100입니다', () => {
  const total = rankingCriteria.reduce((sum, item) => sum + item.weight, 0);
  assert.equal(total, 100);
});

test('산식마다 왜 그런지가 적혀 있습니다', () => {
  // 근거 없는 순위는 신뢰를 한 번에 잃습니다.
  for (const item of rankingCriteria) {
    assert.ok(item.why.length >= 10, `${item.label}의 이유가 너무 짧습니다`);
  }
});

test('광고로 순위를 바꾸지 않는다고 밝힙니다', () => {
  assert.match(RANKING_DISCLOSURE, /광고/);
  assert.match(RANKING_DISCLOSURE, /협찬/);
});

test('순위에 오른 모든 줄에 값이 보입니다', () => {
  // 순위인데 값이 안 보이면 "얼마인지" 때문에 온 사람에게 아무 쓸모가 없습니다.
  const ranked = rankShoes(shoeCatalog, { limit: 5 }, now);
  assert.equal(ranked.length, 5);
  for (const item of ranked) {
    assert.match(priceDisplay(item.shoe, now).headline, /\d/);
  }
});

test('가격이 확인된 신발이 같은 조건에서 위로 옵니다', () => {
  // 가격을 채우면 올라가고 안 채우면 내려갑니다 — 채울 이유가 구조에 들어갑니다.
  const base = {
    subCategory: '입문화' as const,
    levels: ['입문' as const],
    useCase: 'x',
    fitNote: 'x',
    bestForRunner: ['x'],
    notFor: ['x'],
    keyTech: ['x'],
    comparedTo: ['x'],
  };
  const ranked = rankShoes(
    [
      { ...base, id: 'no-price', brand: 'A', model: 'A' },
      {
        ...base,
        id: 'with-price',
        brand: 'B',
        model: 'B',
        price: { listKrw: 129_000, source: 'official' as const, checkedAt: '2026-07-01' },
      },
    ],
    { level: '입문' },
    now,
  );
  assert.equal(ranked[0]?.shoe.id, 'with-price');
});

test('국내에서 못 사는 신발은 아래로 갑니다', () => {
  // 눌러 보고 못 사는 경험만 남습니다.
  const base = {
    subCategory: '입문화' as const,
    levels: ['입문' as const],
    useCase: 'x',
    fitNote: 'x',
    bestForRunner: ['x'],
    notFor: ['x'],
    keyTech: ['x'],
    comparedTo: ['x'],
    price: { listKrw: 129_000, source: 'official' as const, checkedAt: '2026-07-01' },
  };
  const ranked = rankShoes(
    [
      { ...base, id: 'global', brand: 'A', model: 'A', status: 'global-only' },
      { ...base, id: 'korea', brand: 'B', model: 'B', status: 'available' },
    ],
    { level: '입문' },
    now,
  );
  assert.equal(ranked[0]?.shoe.id, 'korea');
});

test('점수가 같으면 싼 것부터 보여 줍니다', () => {
  const base = {
    subCategory: '입문화' as const,
    levels: ['입문' as const],
    status: 'available',
    useCase: 'x',
    fitNote: 'x',
    bestForRunner: ['x'],
    notFor: ['x'],
    keyTech: ['x'],
    comparedTo: ['x'],
  };
  const ranked = rankShoes(
    [
      {
        ...base,
        id: 'pricey',
        brand: 'A',
        model: 'A',
        price: { listKrw: 199_000, source: 'official' as const, checkedAt: '2026-07-01' },
      },
      {
        ...base,
        id: 'cheap',
        brand: 'B',
        model: 'B',
        price: { listKrw: 119_000, source: 'official' as const, checkedAt: '2026-07-01' },
      },
    ],
    { level: '입문' },
    now,
  );
  assert.equal(ranked[0]?.shoe.id, 'cheap');
});

test('갈래를 지정하면 그 갈래만 나옵니다', () => {
  const ranked = rankShoes(shoeCatalog, { subCategory: '안정화', limit: 3 }, now);
  assert.ok(ranked.length > 0);
  for (const item of ranked) assert.equal(item.shoe.subCategory, '안정화');
});

test('지난주 대비 순위 변화를 말로 만듭니다', () => {
  assert.deepEqual(rankDelta('a', 1, ['b', 'a', 'c']), { direction: 'up', steps: 1 });
  assert.deepEqual(rankDelta('a', 3, ['a', 'b', 'c']), { direction: 'down', steps: 2 });
  assert.deepEqual(rankDelta('a', 2, ['b', 'a']), { direction: 'same', steps: 0 });
  assert.deepEqual(rankDelta('z', 1, ['a', 'b']), { direction: 'new', steps: 0 });
  // 지난주 기록이 없으면 화살표를 그리지 않습니다(없는 변화를 지어내지 않습니다).
  assert.deepEqual(rankDelta('a', 1, undefined), { direction: 'same', steps: 0 });
});

test('순위 변화를 화살표가 아니라 말로도 읽어 줍니다', () => {
  assert.equal(rankDeltaLabel({ direction: 'up', steps: 2 }), '2칸 올라옴');
  assert.equal(rankDeltaLabel({ direction: 'new', steps: 0 }), '새로 들어옴');
});
