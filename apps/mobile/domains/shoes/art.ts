// 러닝화 그림을 어떻게 그릴지 정하는 규칙입니다.
//
// 회장 지시: **"러닝화 사진도 나오고"**.
// 우리 제약: 외부 이미지 다운로드 0 · 사진 파일 번들 0 · 브랜드 로고·제품 사진 사용 0 · 월 고정비 0.
//
// 그래서 **앱 안에서 그립니다.** 단색 도형 하나로는 조잡하므로 여섯 층을 쌓습니다.
//
//   1) 아웃솔    바닥
//   2) 미드솔    가장 두꺼운 층 — 쿠션 등급이 두께를 정합니다
//   3) 플레이트  있는 신발만 — 미드솔 안의 얇은 선
//   4) 어퍼      갑피
//   5) 뒷굽      힐 카운터
//   6) 끈        4~5줄
//
// **핵심은 이것입니다: 성격값이 그림을 바꿉니다.**
// 쿠션 최상급은 미드솔이 두껍고, 대회용은 앞코가 크게 들리고, 안정화는 밑창이 넓습니다.
// 그래서 카드를 훑기만 해도 종류가 눈으로 구분됩니다. 다 똑같이 생겼으면 그릴 이유가 없습니다.
//
// 이 파일은 순수합니다. 같은 신발이면 언제나 같은 그림이 나오고, 테스트가 그걸 봅니다.
import type { ShoePlate, ShoeSubCategory } from './taxonomy';

export type ShoeArtSpec = {
  /** 미드솔 두께 비율 0~1. 1이 가장 두껍습니다. */
  midsole: number;
  /** 앞코 들림 비율 0~1. 대회용일수록 큽니다. */
  toeSpring: number;
  /** 밑창 폭 비율 0~1. 안정화가 넓습니다. */
  baseWidth: number;
  /** 플레이트 선을 그릴지. 그린다면 어떤 색인지. */
  plate: ShoePlate;
  /** 갑피 색입니다. 브랜드 색을 씁니다(로고·상표는 그리지 않습니다). */
  upperColor: string;
  /** 미드솔 색입니다. 갑피보다 밝게 둡니다. */
  midsoleColor: string;
  /** 아웃솔 색입니다. 가장 어둡습니다. */
  outsoleColor: string;
  /** 끈 줄 수입니다. */
  laces: number;
};

/**
 * 세부 갈래마다 다른 생김새입니다.
 *
 * 값의 근거는 그 갈래의 실제 성격입니다.
 *   - 맥스 쿠션화는 밑창이 두껍습니다 → midsole 1.0
 *   - 레이싱은 앞코가 크게 들립니다 → toeSpring 0.9
 *   - 안정화는 바닥이 넓습니다 → baseWidth 1.0
 */
const shapeBySubCategory: Record<
  ShoeSubCategory,
  { midsole: number; toeSpring: number; baseWidth: number }
> = {
  입문화: { midsole: 0.5, toeSpring: 0.2, baseWidth: 0.7 },
  '맥스 쿠션화': { midsole: 1, toeSpring: 0.35, baseWidth: 0.8 },
  안정화: { midsole: 0.65, toeSpring: 0.2, baseWidth: 1 },
  올라운더: { midsole: 0.55, toeSpring: 0.3, baseWidth: 0.65 },
  '경량 트레이너': { midsole: 0.35, toeSpring: 0.45, baseWidth: 0.5 },
  '논 플레이트': { midsole: 0.7, toeSpring: 0.5, baseWidth: 0.6 },
  '라이트 플레이트': { midsole: 0.75, toeSpring: 0.6, baseWidth: 0.55 },
  '카본 플레이트': { midsole: 0.85, toeSpring: 0.75, baseWidth: 0.5 },
  중거리: { midsole: 0.45, toeSpring: 0.85, baseWidth: 0.4 },
  장거리: { midsole: 0.9, toeSpring: 0.9, baseWidth: 0.45 },
};

/** #RRGGBB를 원하는 만큼 밝게·어둡게 만듭니다. 색 계산도 순수 함수여야 테스트가 봅니다. */
export function shiftColor(hex: string, amount: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return hex;
  const channels = [0, 2, 4].map((offset) => {
    const value = Number.parseInt(clean.slice(offset, offset + 2), 16);
    const next = Math.round(value + (amount >= 0 ? (255 - value) * amount : value * amount));
    return Math.max(0, Math.min(255, next));
  });
  return `#${channels.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

export function shoeArtSpec(entry: {
  subCategory: ShoeSubCategory;
  plate: ShoePlate;
  brandColor: string;
}): ShoeArtSpec {
  const shape = shapeBySubCategory[entry.subCategory];
  return {
    ...shape,
    plate: entry.plate,
    upperColor: entry.brandColor,
    // 미드솔은 갑피보다 밝게, 아웃솔은 어둡게. 세 층이 붙어 보이지 않게 합니다.
    midsoleColor: shiftColor(entry.brandColor, 0.55),
    outsoleColor: shiftColor(entry.brandColor, -0.55),
    // 밑창이 두꺼울수록 갑피가 낮아 끈 줄이 하나 줄어듭니다.
    laces: shape.midsole >= 0.85 ? 4 : 5,
  };
}

/** 그림 밑에 항상 붙는 한 줄입니다. 이 문장이 없으면 사진으로 오해합니다. */
export const SHOE_ART_CAPTION = '그림은 형태를 나타낸 것으로, 실제 제품과 달라요.';
