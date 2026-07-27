// 대회 포스터를 어떻게 조판할지 정하는 규칙입니다.
//
// 회장 지시: **"대회 포스터도 나오고."**
// 우리 제약: 주최 측 실제 포스터 이미지를 쓰지 않습니다.
//   저작권 문제이기도 하고, 183개 대회의 이미지를 어딘가에서 받아 오면 그 순간 월 고정비가 생깁니다.
//
// 그래서 **대회 정보로 우리가 조판합니다.**
// 목록이 글자만 있으면 조잡해 보이는데, 색과 큰 글자 하나만 있어도 완전히 달라집니다.
//
// 무엇이 색을 정하는가: **대회가 열리는 달(계절)** 입니다.
//   같은 달 대회끼리 색이 같아서, 목록을 훑으면 계절 흐름이 눈에 들어옵니다.
//   무작위 색을 쓰면 그냥 알록달록할 뿐 아무 정보도 주지 않습니다.
//
// 이 파일은 순수합니다. 같은 대회면 언제나 같은 포스터가 나옵니다.

export type RacePosterSpec = {
  /** 배경 그라데이션 위쪽 색입니다. */
  topColor: string;
  /** 배경 그라데이션 아래쪽 색입니다. */
  bottomColor: string;
  /** 글자 색입니다. 배경 대비를 지키려고 배경과 함께 정해집니다. */
  inkColor: string;
  /** 가장 크게 쓰는 말 — 보통 거리입니다. */
  headline: string;
  /** 그 아래 한 줄 — 지역과 날짜입니다. */
  subline: string;
  /** headline 글자 크기 비율 0~1. 글자가 길수록 작아집니다. */
  headlineScale: number;
  /** 계절 이름입니다. 화면 낭독기가 읽습니다. */
  season: SeasonKey;
};

export type SeasonKey = 'spring' | 'summer' | 'autumn' | 'winter';

export const seasonLabels: Record<SeasonKey, string> = {
  spring: '봄',
  summer: '여름',
  autumn: '가을',
  winter: '겨울',
};

/**
 * 계절색입니다.
 *
 * 어두운 배경에 흰 글자를 얹습니다. 밝은 배경 + 어두운 글자를 섞으면
 * 목록에서 카드마다 무게가 달라 보여 어수선해집니다. 하나로 통일합니다.
 */
const seasonPalette: Record<SeasonKey, { top: string; bottom: string }> = {
  // 봄 — 연둣빛에서 짙은 초록으로
  spring: { top: '#4C7B3F', bottom: '#2C5228' },
  // 여름 — 청록에서 짙은 남색으로
  summer: { top: '#1F6F78', bottom: '#12414C' },
  // 가을 — 주황에서 적갈색으로 (대회가 가장 많은 계절입니다)
  autumn: { top: '#B85A21', bottom: '#7A3312' },
  // 겨울 — 남색에서 먹빛으로
  winter: { top: '#33486B', bottom: '#1D2A40' },
};

export function seasonForMonth(month: number): SeasonKey {
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

/**
 * 포스터에 가장 크게 쓸 말입니다.
 *
 * 거리를 씁니다. 대회를 고를 때 가장 먼저 보는 것이 "몇 킬로냐"이기 때문입니다.
 * 여러 종목이면 **가장 긴 것** 하나만 씁니다. "5K/10K/하프"를 다 넣으면 작아서 안 보입니다.
 */
const distanceOrder = ['풀', '풀코스', '마라톤', '하프', 'Trail', '트레일', '10K', '5K', '3K'];

export function posterHeadline(distances: string[]): string {
  if (distances.length === 0) return 'RUN';
  for (const candidate of distanceOrder) {
    const found = distances.find((value) => value === candidate);
    if (found) return found;
  }
  return distances[0] as string;
}

/** 글자가 길면 줄여서 넣습니다. 잘리는 것보다 작은 편이 낫습니다. */
export function headlineScale(headline: string): number {
  if (headline.length <= 3) return 1;
  if (headline.length <= 5) return 0.72;
  return 0.52;
}

export type PosterInput = {
  raceDate: string;
  region?: string;
  distances?: string[];
};

export function racePosterSpec(race: PosterInput): RacePosterSpec {
  const date = new Date(`${race.raceDate}T00:00:00+09:00`);
  const valid = !Number.isNaN(date.getTime());
  const month = valid ? date.getMonth() + 1 : 1;
  const day = valid ? date.getDate() : 1;
  const season = seasonForMonth(month);
  const colors = seasonPalette[season];
  const headline = posterHeadline(race.distances ?? []);

  return {
    topColor: colors.top,
    bottomColor: colors.bottom,
    // 어두운 배경 위 흰 글자로 통일합니다.
    inkColor: '#FFFFFF',
    headline,
    subline: valid
      ? `${race.region ? `${race.region} · ` : ''}${month}월 ${day}일`
      : (race.region ?? '날짜 미정'),
    headlineScale: headlineScale(headline),
    season,
  };
}

/** 포스터를 화면 낭독기가 읽을 말입니다. 그림만 있고 설명이 없으면 안 보이는 것과 같습니다. */
export function posterAccessibilityLabel(spec: RacePosterSpec, raceName: string): string {
  return `${raceName} 포스터. ${spec.headline}, ${spec.subline}, ${seasonLabels[spec.season]} 대회`;
}
