/**
 * Visual tokens from the approved mockup. Bright, rounded, chunky.
 * Component palette slots (primary/secondary/accent/neutral/highlight) map here so the
 * model never chooses raw colors.
 */
export const colors = {
  ink: '#1F1535',
  muted: '#6B6480',
  bg: '#FFFFFF',
  soft: '#F3F0FA',
  line: '#E9E5F5',
  purple: '#6D28D9',
  purpleDeep: '#4C1D95',
  purpleTint: '#DDD6FE',
  yellow: '#FFC53D',
  yellowDeep: '#CF9A1B',
  yellowTint: '#FDE68A',
  coral: '#FF7A59',
  coralDeep: '#C2410C',
  coralTint: '#FFF4E5',
  mint: '#14B8A6',
  mintDeep: '#0F766E',
  mintTint: '#CCFBF1',
  green: '#34D399',
  greenTint: '#ECFDF5',
  orangeLine: '#FDBA74',
} as const;

export const palette: Record<'primary' | 'secondary' | 'accent' | 'neutral' | 'highlight', { fill: string; shadow: string; text: string }> = {
  primary: { fill: colors.purple, shadow: colors.purpleDeep, text: '#FFFFFF' },
  secondary: { fill: colors.coral, shadow: colors.coralDeep, text: colors.ink },
  accent: { fill: colors.yellow, shadow: colors.yellowDeep, text: colors.ink },
  neutral: { fill: colors.line, shadow: '#D6D0E8', text: colors.ink },
  highlight: { fill: colors.mint, shadow: colors.mintDeep, text: colors.ink },
};

export const fonts = {
  bold: 'Nunito_700Bold',
  extraBold: 'Nunito_800ExtraBold',
  black: 'Nunito_900Black',
} as const;

export const radius = { sm: 12, md: 16, lg: 20, xl: 24, pill: 999 } as const;
export const space = { xs: 6, sm: 10, md: 16, lg: 20, xl: 28 } as const;
