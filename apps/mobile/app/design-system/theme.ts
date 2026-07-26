// 러닝봄 vNext의 색상, 간격, 글자 크기 토큰을 한곳에서 정의합니다.
export const palette = {
  canvas: '#F8F7F4',
  surface: '#FFFFFF',
  surfaceWarm: '#FFF2EA',
  surfaceMuted: '#EEEDE8',
  ink: '#182033',
  inkSoft: '#4F5B6D',
  muted: '#768091',
  line: '#DEDCD5',
  accent: '#F26B3A',
  accentDark: '#B9431D',
  accentSoft: '#FFE2D4',
  positive: '#1F7A5A',
  positiveSoft: '#E3F3EC',
  warning: '#8B671C',
  warningSoft: '#FFF1CF',
  danger: '#B33C34',
  dangerSoft: '#FCE7E5',
  navy: '#233654',
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
  caption: 12,
  bodySmall: 14,
  body: 16,
  titleSmall: 18,
  title: 22,
  display: 30,
} as const;

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
