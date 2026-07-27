// 러닝화 가격 표시 규칙을 검증합니다.
//
// 여기서 보는 것 하나가 나머지 전부보다 중요합니다:
//   **어떤 신발이든 카드에 숫자가 나온다.**
// 회장 지시가 "가격이 무조건 나와야 한다"이고, 우리 규칙이 "지어내지 않는다"이므로,
// 이 두 개를 동시에 지키는지는 코드가 아니라 **테스트가** 증명해야 합니다.
import assert from 'node:assert/strict';
import test from 'node:test';

import { shoeCatalog } from '../domains/shoes/catalog';
import {
  PRICE_STALE_DAYS,
  bandRangeLabel,
  basisLabel,
  formatKrw,
  formatKrwRange,
  priceBandRanges,
  priceCoverage,
  priceDisplay,
  priceFilterBands,
  priceMatchesBand,
  validatePrices,
} from '../domains/shoes/price';
import { shoePriceBands } from '../domains/shoes/taxonomy';

const now = new Date('2026-07-27T00:00:00Z');

test('가격이 확인되지 않아도 카드에 숫자가 나옵니다', () => {
  // 이게 이 파일에서 가장 중요한 테스트입니다.
  // 빈칸이 나오면 살지 말지 판단이 안 되고, 그러면 목록을 볼 이유가 없습니다.
  const shown = priceDisplay({ priceBand: '하이' }, now);
  assert.match(shown.headline, /\d/);
  assert.equal(shown.confirmed, false);
});

test('카탈로그의 모든 신발이 값을 가집니다', () => {
  // 123종을 전부 돌려 봅니다. 한 켤레라도 빈칸이면 실패입니다.
  for (const shoe of shoeCatalog) {
    const shown = priceDisplay(shoe, now);
    assert.notEqual(shown.headline.trim(), '', `${shoe.id}의 가격 줄이 비었습니다`);
    assert.match(shown.headline, /\d/, `${shoe.id}의 가격 줄에 숫자가 없습니다`);
  }
});

test('확인된 정가는 가격대 범위보다 우선합니다', () => {
  const shown = priceDisplay(
    {
      priceBand: '하이',
      price: { listKrw: 199_000, source: 'official', checkedAt: '2026-07-01' },
    },
    now,
  );
  assert.equal(shown.headline, '199,000원');
  assert.equal(shown.confirmed, true);
});

test('확인된 가격에는 언제·어디서인지가 반드시 붙습니다', () => {
  // 출처와 시점이 없는 가격은 거짓말이 됩니다.
  const shown = priceDisplay(
    {
      priceBand: '하이',
      price: { listKrw: 199_000, source: 'official', checkedAt: '2026-07-01' },
    },
    now,
  );
  assert.ok(shown.basis);
  assert.match(shown.basis as string, /2026년 7월/);
  assert.match(shown.basis as string, /브랜드 공식/);
});

test('오래된 가격에는 경고가 붙습니다', () => {
  const old = new Date(now);
  old.setDate(old.getDate() - (PRICE_STALE_DAYS + 10));
  const shown = priceDisplay(
    {
      priceBand: '하이',
      price: {
        listKrw: 199_000,
        source: 'official',
        checkedAt: old.toISOString().slice(0, 10),
      },
    },
    now,
  );
  assert.equal(shown.warning, '오래된 가격일 수 있어요');
});

test('실구매 범위가 있으면 그걸 아래 줄에 씁니다', () => {
  const shown = priceDisplay(
    {
      priceBand: '하이',
      price: {
        listKrw: 199_000,
        streetLowKrw: 159_000,
        streetHighKrw: 199_000,
        source: 'official',
        checkedAt: '2026-07-01',
      },
    },
    now,
  );
  assert.match(shown.detail, /159,000원 ~ 199,000원/);
});

test('가격대 이름마다 실제 범위가 정의돼 있습니다', () => {
  // '하이'라고만 쓰면 사용자는 아무 판단도 못 합니다. 필요한 건 등급이 아니라 숫자입니다.
  for (const band of shoePriceBands) {
    assert.ok(priceBandRanges[band], `${band}의 범위가 없습니다`);
    assert.match(bandRangeLabel(band), /\d/);
  }
});

test('가격대 구간이 서로 겹치지 않고 이어집니다', () => {
  const ordered = ['엔트리', '미들', '하이', '프리미엄'] as const;
  for (let index = 0; index < ordered.length - 1; index += 1) {
    const current = priceBandRanges[ordered[index]];
    const next = priceBandRanges[ordered[index + 1]];
    assert.ok(current.highKrw !== undefined);
    assert.ok(
      (current.highKrw as number) < next.lowKrw,
      `${ordered[index]}와 ${ordered[index + 1]}가 겹칩니다`,
    );
  }
});

test('첫 화면 가격대 입구가 네 개 다 있습니다', () => {
  assert.equal(priceFilterBands.length, shoePriceBands.length);
});

test('숫자 표기는 천 단위로 끊습니다', () => {
  assert.equal(formatKrw(159000), '159,000원');
  assert.equal(formatKrwRange(120000, 169000), '120,000원 ~ 169,000원');
  assert.equal(formatKrwRange(230000), '230,000원 이상');
});

test('정가가 가격대와 어긋나면 잡습니다', () => {
  assert.equal(priceMatchesBand(199_000, '하이'), true);
  assert.equal(priceMatchesBand(99_000, '하이'), false);
});

test('지어낸 값·뒤집힌 범위·미래 날짜를 막습니다', () => {
  const problems = validatePrices(
    [
      // 0원
      { id: 'a', priceBand: '하이', price: { listKrw: 0, source: 'official', checkedAt: '2026-07-01' } },
      // 자릿수 실수
      { id: 'b', priceBand: '프리미엄', price: { listKrw: 9_900_000, source: 'official', checkedAt: '2026-07-01' } },
      // 미래에 확인할 수는 없습니다
      { id: 'c', priceBand: '하이', price: { listKrw: 199_000, source: 'official', checkedAt: '2027-01-01' } },
      // 범위가 뒤집힘
      {
        id: 'd',
        priceBand: '하이',
        price: {
          listKrw: 199_000,
          streetLowKrw: 199_000,
          streetHighKrw: 150_000,
          source: 'official',
          checkedAt: '2026-07-01',
        },
      },
      // 가격대와 어긋남
      { id: 'e', priceBand: '엔트리', price: { listKrw: 250_000, source: 'official', checkedAt: '2026-07-01' } },
    ],
    now,
  );
  const codes = new Set(problems.map((problem) => problem.code));
  assert.ok(codes.has('price-nonpositive'));
  assert.ok(codes.has('price-implausible'));
  assert.ok(codes.has('price-future-date'));
  assert.ok(codes.has('price-range-inverted'));
  assert.ok(codes.has('price-band-mismatch'));
});

test('실구매가 정가보다 비싸면 잡습니다', () => {
  // 정가보다 비싸게 파는 값을 우리가 안내할 이유가 없습니다.
  const problems = validatePrices(
    [
      {
        id: 'a',
        priceBand: '하이',
        price: {
          listKrw: 199_000,
          streetHighKrw: 220_000,
          source: 'official',
          checkedAt: '2026-07-01',
        },
      },
    ],
    now,
  );
  assert.ok(problems.some((problem) => problem.code === 'price-above-list'));
});

test('지금 카탈로그에 가격 규칙 위반이 없습니다', () => {
  assert.deepEqual(validatePrices(shoeCatalog, now), []);
});

test('가격 확인률을 셉니다', () => {
  // 목표는 100%입니다. 안 세면 "가격 확인 중"이 영원히 남습니다.
  const coverage = priceCoverage(
    [
      { price: { listKrw: 100_000, source: 'official', checkedAt: '2026-07-01' } },
      {},
      {},
      {},
    ],
    now,
  );
  assert.equal(coverage.total, 4);
  assert.equal(coverage.confirmed, 1);
  assert.equal(coverage.percent, 25);
});

test('확인 시점을 월까지만 씁니다', () => {
  // 며칠에 확인했는지는 가격 판단에 의미가 없습니다.
  assert.equal(basisLabel('2026-07-01', 'official'), '2026년 7월 기준 · 브랜드 공식');
});
