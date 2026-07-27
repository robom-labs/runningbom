// 러닝화 가격 표시 규칙입니다.
//
// 회장 지시: **"가격이 중요해. 무조건 나와야 해. 신발 가격에 따라 고민하는 게 대부분이야."**
// 우리 규칙: **없는 값을 지어내지 않습니다.**
//
// 둘 다 지키는 방법은 하나뿐입니다 — **두 층으로 나눕니다.**
//
//   1층 (모든 신발에 항상 있음)  가격대 범위
//        "이 갈래는 대체로 17만~23만원" — 갈래에 대한 사실이지, 그 신발의 값이 아닙니다.
//        그래서 지어낸 값이 아니고, 동시에 **빈칸이 절대 생기지 않습니다.**
//
//   2층 (확인된 신발만)          정가
//        브랜드 국내 공식 페이지에서 사람이 확인한 값입니다.
//        확인 시점과 출처가 **반드시 함께** 붙습니다. 셋 중 하나라도 없으면 화면에 내지 않습니다.
//
// 화면은 2층이 있으면 2층을 크게, 없으면 1층을 크게 씁니다.
// 어느 쪽이든 **숫자가 없는 카드는 나오지 않습니다.**
//
// 이 파일은 순수합니다. react-native를 import하지 않습니다.
import type { ShoePriceBand } from './taxonomy';

/** 어디서 확인한 값인지입니다. 여기 없는 출처는 쓰지 않습니다. */
export type PriceSource =
  /** 브랜드 국내 공식 온라인 스토어 */
  | 'official'
  /** 브랜드 공식 아웃렛·공식 리셀러 */
  | 'brand-outlet';

export const priceSourceLabels: Record<PriceSource, string> = {
  official: '브랜드 공식',
  'brand-outlet': '공식 아웃렛',
};

export type ShoePrice = {
  /** 공식 판매가(정가). 원. 이 값 없이 범위만 두는 것은 금지입니다. */
  listKrw: number;
  /** 실구매 범위 하단. 할인해서 사는 값입니다. */
  streetLowKrw?: number;
  /** 실구매 범위 상단. 보통 정가와 같습니다. */
  streetHighKrw?: number;
  source: PriceSource;
  /** 확인한 날. YYYY-MM-DD. */
  checkedAt: string;
};

/**
 * 가격대 이름이 실제로 몇 원인지입니다.
 *
 * 왜 이 표가 필요한가:
 *   `priceBand: '하이'` 만으로는 사용자가 아무 판단도 못 합니다. "하이가 얼마인데?"
 *   가격 때문에 고민하는 사람에게 필요한 건 등급 이름이 아니라 **숫자**입니다.
 *
 * 이 값은 2026년 국내 러닝화 시장 가격대를 구간으로 나눈 편집 기준입니다.
 * 특정 신발의 값이 아니라 **구간의 정의**이므로, 지어낸 값이 아닙니다.
 * 구간이 바뀌면 이 표만 고칩니다.
 */
export const priceBandRanges: Record<ShoePriceBand, { lowKrw: number; highKrw?: number }> = {
  엔트리: { lowKrw: 70_000, highKrw: 119_000 },
  미들: { lowKrw: 120_000, highKrw: 169_000 },
  하이: { lowKrw: 170_000, highKrw: 229_000 },
  프리미엄: { lowKrw: 230_000 },
};

/** 확인한 지 이만큼 지나면 "오래된 값일 수 있어요"를 같이 씁니다. */
export const PRICE_STALE_DAYS = 180;

/** 천 단위 쉼표. Intl 없이 동작해야 합니다(Hermes 호환). */
export function formatKrw(value: number): string {
  return `${Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',')}원`;
}

/** "170,000 ~ 229,000원" 또는 "230,000원 이상". */
export function formatKrwRange(lowKrw: number, highKrw?: number): string {
  if (highKrw === undefined) return `${formatKrw(lowKrw)} 이상`;
  if (highKrw === lowKrw) return formatKrw(lowKrw);
  return `${formatKrw(lowKrw)} ~ ${formatKrw(highKrw)}`;
}

/** 이 가격대의 범위를 말로 만든 것입니다. 모든 신발이 이걸 가집니다. */
export function bandRangeLabel(band: ShoePriceBand): string {
  const range = priceBandRanges[band];
  return formatKrwRange(range.lowKrw, range.highKrw);
}

/** 확인한 정가가 그 신발의 가격대와 어긋나는지입니다. 어긋나면 둘 중 하나가 틀린 것입니다. */
export function priceMatchesBand(listKrw: number, band: ShoePriceBand): boolean {
  const range = priceBandRanges[band];
  if (listKrw < range.lowKrw) return false;
  if (range.highKrw !== undefined && listKrw > range.highKrw) return false;
  return true;
}

function daysBetween(fromIso: string, now: Date): number {
  const from = new Date(`${fromIso}T00:00:00Z`);
  if (Number.isNaN(from.getTime())) return Number.POSITIVE_INFINITY;
  return Math.floor((now.getTime() - from.getTime()) / 86_400_000);
}

/** 확인한 날을 "2026년 7월 기준"으로 씁니다. 며칠인지는 가격에 의미가 없습니다. */
export function basisLabel(checkedAt: string, source: PriceSource): string {
  const [year, month] = checkedAt.split('-');
  const when = year && month ? `${year}년 ${Number(month)}월 기준` : '확인 시점 미상';
  return `${when} · ${priceSourceLabels[source]}`;
}

export type PriceDisplay = {
  /** 카드에서 가장 크게 쓰는 줄입니다. 절대 비지 않습니다. */
  headline: string;
  /** 그 아래 한 줄. 정가가 있으면 실구매 범위, 없으면 무엇을 보고 있는지 설명입니다. */
  detail: string;
  /** 언제·어디서 확인한 값인지. 확인된 가격에만 붙습니다. */
  basis?: string;
  /** 오래된 값이면 붙는 경고입니다. */
  warning?: string;
  /** 정가가 확인된 신발인지입니다. 순위·정렬이 이 값을 봅니다. */
  confirmed: boolean;
};

/**
 * 카드·상세에 그대로 쓰는 가격 표시입니다.
 *
 * **어떤 입력에도 headline이 빈 문자열이 되지 않습니다.** 그것이 이 함수의 계약입니다.
 * 가격이 비어 있는 카드는 살지 말지 판단이 안 되고, 그러면 앱을 열 이유가 없습니다.
 */
export function priceDisplay(
  input: { priceBand: ShoePriceBand; price?: ShoePrice },
  now: Date,
): PriceDisplay {
  const { price, priceBand } = input;

  if (!price) {
    // 정가를 아직 확인 못 했습니다. 그래도 **숫자는 나옵니다.**
    return {
      headline: bandRangeLabel(priceBand),
      detail: '이 갈래의 보통 가격대예요. 정가는 확인 중이에요.',
      confirmed: false,
    };
  }

  const low = price.streetLowKrw;
  const high = price.streetHighKrw ?? price.listKrw;
  const detail =
    low !== undefined && low < high
      ? `실구매 ${formatKrwRange(low, high)}`
      : '매장·시기에 따라 다를 수 있어요';

  const stale = daysBetween(price.checkedAt, now) > PRICE_STALE_DAYS;

  return {
    headline: formatKrw(price.listKrw),
    detail,
    basis: basisLabel(price.checkedAt, price.source),
    ...(stale ? { warning: '오래된 가격일 수 있어요' } : {}),
    confirmed: true,
  };
}

/** 첫 화면의 가격대 입구입니다. 용도 갈래와 같은 크기로 둡니다. */
export const priceFilterBands: { band: ShoePriceBand; label: string }[] = [
  { band: '엔트리', label: '12만원 아래' },
  { band: '미들', label: '12~17만원' },
  { band: '하이', label: '17~23만원' },
  { band: '프리미엄', label: '23만원 위' },
];

export type PriceCoverage = {
  total: number;
  /** 정가가 확인된 수 */
  confirmed: number;
  /** 확인한 지 오래된 수 */
  stale: number;
  /** 확인률 0~100 정수 */
  percent: number;
};

/**
 * 가격을 얼마나 채웠는지입니다. 목표는 100%입니다.
 *
 * 이 숫자를 매주 리포트로 뽑는 이유: 목표는 선언이 아니라 **세어지는 것**이어야 합니다.
 * 안 세면 "가격 확인 중"이 영원히 남습니다.
 */
export function priceCoverage(
  entries: { price?: ShoePrice }[],
  now: Date,
): PriceCoverage {
  const total = entries.length;
  const withPrice = entries.filter((entry) => entry.price);
  const stale = withPrice.filter(
    (entry) => daysBetween((entry.price as ShoePrice).checkedAt, now) > PRICE_STALE_DAYS,
  ).length;
  return {
    total,
    confirmed: withPrice.length,
    stale,
    percent: total === 0 ? 0 : Math.round((withPrice.length / total) * 100),
  };
}

export type PriceProblem = { id: string; code: string; message: string };

/**
 * 가격 값이 규칙을 지키는지 검사합니다. 실패하면 CI가 막습니다.
 *
 * 예전에는 `priceKrw`가 **금지 필드**였습니다. 값을 지어낼까 봐 아예 못 넣게 한 것입니다.
 * 지금은 넣을 수 있게 하되 **더 엄격한 규칙으로 바꿉니다.** 규칙을 푼 게 아닙니다.
 */
export function validatePrices(
  entries: { id: string; priceBand: ShoePriceBand; price?: ShoePrice }[],
  now: Date,
): PriceProblem[] {
  const problems: PriceProblem[] = [];
  const todayIso = now.toISOString().slice(0, 10);

  for (const entry of entries) {
    const { price } = entry;
    if (!price) continue;

    if (!Number.isFinite(price.listKrw) || price.listKrw <= 0) {
      problems.push({ id: entry.id, code: 'price-nonpositive', message: '정가가 0원 이하입니다' });
    }
    // 러닝화가 만원 아래이거나 백만원 위면 자릿수를 잘못 옮긴 것입니다.
    if (price.listKrw > 0 && (price.listKrw < 10_000 || price.listKrw > 1_000_000)) {
      problems.push({
        id: entry.id,
        code: 'price-implausible',
        message: `정가 ${price.listKrw}원은 러닝화 값으로 보기 어렵습니다`,
      });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(price.checkedAt)) {
      problems.push({ id: entry.id, code: 'price-bad-date', message: '확인 날짜 형식이 틀립니다' });
    } else if (price.checkedAt > todayIso) {
      // 미래에 확인할 수는 없습니다.
      problems.push({ id: entry.id, code: 'price-future-date', message: '확인 날짜가 미래입니다' });
    }
    if (price.streetLowKrw !== undefined && price.streetHighKrw !== undefined) {
      if (price.streetLowKrw > price.streetHighKrw) {
        problems.push({ id: entry.id, code: 'price-range-inverted', message: '실구매 범위가 뒤집혔습니다' });
      }
    }
    if (price.streetHighKrw !== undefined && price.streetHighKrw > price.listKrw) {
      // 정가보다 비싸게 파는 값을 우리가 안내할 이유가 없습니다.
      problems.push({
        id: entry.id,
        code: 'price-above-list',
        message: '실구매 상단이 정가보다 높습니다',
      });
    }
    if (!priceMatchesBand(price.listKrw, entry.priceBand)) {
      problems.push({
        id: entry.id,
        code: 'price-band-mismatch',
        message: `정가 ${price.listKrw}원이 가격대 '${entry.priceBand}'와 맞지 않습니다`,
      });
    }
  }

  return problems;
}
