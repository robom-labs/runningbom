// 엠블럼(배지 그림)의 색과 링 규칙입니다.
// 색은 theme.ts의 팔레트 안에서만 고르고, 등급 차이는 "채도"와 "링 개수·두께"로만 냅니다.
// 금색·무지개처럼 앱 톤 밖의 색은 쓰지 않습니다.
import { palette } from '../theme';
import type { BadgeTier } from '../../../domains/badges/rules';

export type EmblemState = 'earned' | 'progress' | 'locked';

export type EmblemSkin = {
  /** 테두리 안쪽 면 색입니다. */
  field: string;
  /** 링(테두리) 색입니다. */
  ring: string;
  /** 안쪽 도형 색입니다. */
  glyph: string;
  /** 링 개수입니다. 등급이 오를수록 늘어납니다. */
  rings: 1 | 2 | 3;
  /** 가장 바깥 링의 두께입니다. */
  ringWidth: number;
};

/**
 * 등급별 피부색입니다. 채도가 씨앗 → 만개로 갈수록 올라갑니다.
 * 씨앗은 무채색에 가깝고, 만개만 진한 남색 면을 써서 확실히 다르게 보입니다.
 */
export const tierSkins: Record<BadgeTier, EmblemSkin> = {
  seed: {
    field: palette.surfaceMuted,
    ring: palette.muted,
    glyph: palette.inkSoft,
    rings: 1,
    ringWidth: 1.6,
  },
  sprout: {
    field: palette.positiveSoft,
    ring: palette.positive,
    glyph: palette.positive,
    rings: 1,
    ringWidth: 2.6,
  },
  bud: {
    field: palette.accentSoft,
    ring: palette.accent,
    glyph: palette.accentDark,
    rings: 2,
    ringWidth: 2.6,
  },
  bloom: {
    field: palette.navy,
    ring: palette.onNavyAccent,
    glyph: palette.onNavyAccent,
    rings: 3,
    ringWidth: 2.8,
  },
};

/** 아직 못 받은 배지는 같은 도형을 흐릿한 실루엣으로만 보여 줍니다. */
export const lockedSkin: EmblemSkin = {
  field: palette.surface,
  ring: palette.line,
  glyph: palette.line,
  rings: 1,
  ringWidth: 1.6,
};

/** 진행 중인 배지는 잠긴 것보다 조금 더 또렷하되, 받은 것과는 확실히 구분합니다. */
export const progressSkin: EmblemSkin = {
  field: palette.surface,
  ring: palette.line,
  glyph: palette.muted,
  rings: 1,
  ringWidth: 1.6,
};

export function skinFor(tier: BadgeTier, state: EmblemState): EmblemSkin {
  if (state === 'earned') return tierSkins[tier];
  return state === 'progress' ? progressSkin : lockedSkin;
}

/** 진행 호(테두리를 따라 차오르는 선)의 색입니다. */
export const progressArcColor = palette.accentStrong;

/** 엠블럼을 그리는 좌표계입니다. 모든 도형이 이 안에 들어옵니다. */
export const emblemViewBox = 100;
