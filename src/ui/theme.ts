import { DarkTheme } from 'expo-router';

/**
 * Paleta de la pintadera del icono: azul noche, azul, amarillo y blanco hueso (los de la bandera canaria).
 * El amarillo es la acción principal y los logros; el azul, lo estructural y lo informativo.
 */
export const colors = {
  bg: '#0B1B2B',
  card: '#11263B',
  // Campos y controles: un paso de azul que se distingue de la tarjeta.
  cardHigh: '#1B3653',
  border: '#27425F',
  text: '#F4F6F8',
  // Texto secundario y terciario: contraste WCAG AA sobre los tres fondos (≥ 4,5:1).
  muted: '#AEBDCC',
  faint: '#93A6BA',
  accent: '#FFCC00',
  /** Texto e iconos sobre el amarillo. */
  onAccent: '#0B1B2B',
  // Naranja, para no confundirse con el amarillo del acento.
  warn: '#FF9F45',
  accentSoft: 'rgba(255, 204, 0, 0.14)',
  success: '#4ADE9A',
  successSoft: 'rgba(74, 222, 154, 0.14)',
  danger: '#FF6B6B',
  dangerSoft: 'rgba(255, 107, 107, 0.14)',
  info: '#6DB3EE',
  infoSoft: 'rgba(63, 143, 210, 0.2)',
} as const;

export const radius = { sm: 10, md: 16, lg: 22, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/**
 * Tipografías. Big Shoulders (condensada y contundente, de rótulo industrial) para las cifras
 * y los titulares grandes; Instrument Sans para todo lo demás. Con fuentes propias el grosor
 * va en el nombre de la familia, no en `fontWeight`.
 */
export const fonts = {
  display: 'BigShoulders_800ExtraBold',
  regular: 'InstrumentSans_400Regular',
  medium: 'InstrumentSans_500Medium',
  semi: 'InstrumentSans_600SemiBold',
  bold: 'InstrumentSans_700Bold',
} as const;

/** Para extender en un estilo: `{ fontSize: 15, ...font.w700 }`. */
export const font = {
  // Instrument Sans trae los espacios algo justos: un poco de aire entre letras la hace más legible en pequeño.
  w400: { fontFamily: fonts.regular, letterSpacing: 0.2 },
  w600: { fontFamily: fonts.semi, letterSpacing: 0.2 },
  w700: { fontFamily: fonts.bold, letterSpacing: 0.2 },
  w800: { fontFamily: fonts.bold, letterSpacing: 0.2 },
  /** Cifras y titulares grandes. La condensada necesita un poco de aire entre letras. */
  display: { fontFamily: fonts.display, letterSpacing: 0.3 },
} as const;

export const type = {
  hero: { fontSize: 36, lineHeight: 38, ...font.display, color: colors.text },
  title: { fontSize: 20, lineHeight: 26, ...font.w700, color: colors.text },
  subtitle: { fontSize: 15, lineHeight: 21, ...font.w600, color: colors.text },
  body: { fontSize: 15, lineHeight: 21, ...font.w400, color: colors.text },
  caption: { fontSize: 13, lineHeight: 18, ...font.w400, color: colors.muted },
  /** Rótulo de sección o de apoyo, en minúscula. */
  overline: { fontSize: 14, lineHeight: 19, ...font.w600, color: colors.muted },
};

export const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accent,
    background: colors.bg,
    card: colors.bg,
    text: colors.text,
    border: colors.border,
  },
  fonts: {
    regular: { fontFamily: fonts.regular, fontWeight: '400' as const },
    medium: { fontFamily: fonts.medium, fontWeight: '500' as const },
    bold: { fontFamily: fonts.bold, fontWeight: '700' as const },
    heavy: { fontFamily: fonts.bold, fontWeight: '700' as const },
  },
};
