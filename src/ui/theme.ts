import { DarkTheme } from 'expo-router';

export const colors = {
  bg: '#0E0F12',
  card: '#17191E',
  cardHigh: '#1F2228',
  border: '#2A2E36',
  text: '#F2F3F5',
  muted: '#8B909A',
  faint: '#5A5F69',
  accent: '#FF6B35',
  accentSoft: 'rgba(255, 107, 53, 0.14)',
  success: '#3DDC97',
  successSoft: 'rgba(61, 220, 151, 0.14)',
  danger: '#FF5C5C',
  dangerSoft: 'rgba(255, 92, 92, 0.14)',
  info: '#6CA6FF',
  infoSoft: 'rgba(108, 166, 255, 0.14)',
} as const;

export const radius = { sm: 10, md: 16, lg: 22, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const type = {
  hero: { fontSize: 30, fontWeight: '800' as const, color: colors.text, letterSpacing: -0.5 },
  title: { fontSize: 20, fontWeight: '700' as const, color: colors.text },
  subtitle: { fontSize: 15, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 15, color: colors.text },
  caption: { fontSize: 13, color: colors.muted },
  overline: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: colors.muted,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
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
};
