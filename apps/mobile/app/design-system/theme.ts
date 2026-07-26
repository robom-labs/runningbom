// 러닝봄 vNext의 색상, 간격, 글자 크기 토큰을 한곳에서 정의합니다.
// 값은 추가·개선만 하고 기존 export 이름은 지우지 않습니다(화면들이 이 이름으로 참조합니다).
export const palette = {
  canvas: '#F8F7F4',
  surface: '#FFFFFF',
  surfaceWarm: '#FFF2EA',
  surfaceMuted: '#EEEDE8',
  ink: '#182033',
  inkSoft: '#4F5B6D',
  // 흰 배경에서 4.5:1을 넘도록 조정한 보조 텍스트 색입니다(이전 #768091은 3.99:1로 AA 미달).
  muted: '#5E6979',
  line: '#DEDCD5',
  accent: '#F26B3A',
  // 흰 글자를 얹는 상호작용 면(기본 버튼·D-day 배지)에 쓰는 진한 주황입니다. 흰 글자와 4.7:1.
  accentStrong: '#C9481B',
  accentDark: '#A63B18',
  accentSoft: '#FFE2D4',
  positive: '#1F7A5A',
  positiveSoft: '#E3F3EC',
  warning: '#8B671C',
  warningSoft: '#FFF1CF',
  danger: '#B33C34',
  dangerSoft: '#FCE7E5',
  navy: '#233654',
  navySoft: '#33486B',
  // 남색 면 위에 올리는 글자색입니다(모두 navy 대비 4.5:1 이상).
  onNavy: '#FFFFFF',
  onNavySoft: '#CCD5E3',
  onNavyMuted: '#A9B5C6',
  onNavyAccent: '#FFB596',
  // 드로어·모달 뒤에 까는 반투명 막입니다.
  scrim: 'rgba(17, 17, 17, 0.42)',
  // 로딩 자리표시자(스켈레톤) 색입니다.
  skeleton: '#E7E5DF',
  white: '#FFFFFF',
  black: '#111111',
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 12,
  md: 18,
  lg: 24,
  pill: 999,
} as const;

export const typeScale = {
  micro: 11,
  caption: 12,
  label: 13,
  bodySmall: 14,
  body: 16,
  titleSmall: 18,
  title: 22,
  headline: 26,
  display: 30,
} as const;

// 글자 크기별 기본 줄 간격입니다. 200% 확대에서도 줄이 겹치지 않게 넉넉히 잡았습니다.
export const lineHeight = {
  micro: 16,
  caption: 18,
  label: 19,
  bodySmall: 21,
  body: 24,
  titleSmall: 25,
  title: 29,
  headline: 32,
  display: 36,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '600',
  semibold: '700',
  bold: '800',
  heavy: '900',
} as const;

export const borderWidth = {
  thin: 1,
  emphasis: 1.5,
} as const;

// 화면 공통 레이아웃 값입니다. 터치 대상은 48px을 하한으로 씁니다.
export const layout = {
  screenMaxWidth: 960,
  wideMaxWidth: 1120,
  touchTarget: 48,
  gutter: spacing.md,
} as const;

// 카드·떠 있는 표면의 그림자 규칙입니다. 두 단계만 씁니다.
export const elevation = {
  card: {
    shadowColor: '#0B1220',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  raised: {
    shadowColor: '#0B1220',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
} as const;

export const motion = {
  fast: 140,
  base: 200,
  slow: 260,
} as const;

// 눌림 피드백 투명도를 화면마다 다르게 쓰지 않도록 한 값으로 고정합니다.
export const pressedOpacity = 0.72;

export const appTheme = {
  dark: false,
  colors: {
    primary: palette.accent,
    background: palette.canvas,
    card: palette.surface,
    text: palette.ink,
    border: palette.line,
    notification: palette.accent,
  },
  fonts: {
    regular: { fontFamily: 'System', fontWeight: '400' as const },
    medium: { fontFamily: 'System', fontWeight: '600' as const },
    bold: { fontFamily: 'System', fontWeight: '700' as const },
    heavy: { fontFamily: 'System', fontWeight: '900' as const },
  },
};
