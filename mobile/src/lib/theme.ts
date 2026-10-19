// The same colours as global.css, for places that take a value rather than a
// class: React Navigation's theme, tab bar icons and status bar.

import { DarkTheme, DefaultTheme, type Theme } from 'expo-router';

export const THEME = {
  light: {
    background: 'hsl(220 37.5% 96.9%)',
    foreground: 'hsl(220 48.8% 8.4%)',
    card: 'hsl(0 0% 100%)',
    primary: 'hsl(226.9 69% 45.5%)',
    mutedForeground: 'hsl(221.4 13.7% 41.4%)',
    border: 'hsl(220 33.3% 91.2%)',
    destructive: 'hsl(1.6 61% 47.3%)',
  },
  dark: {
    background: 'hsl(220 48.8% 8.4%)',
    foreground: 'hsl(220 54.5% 95.7%)',
    card: 'hsl(220 41.5% 12.7%)',
    primary: 'hsl(226.1 100% 78%)',
    mutedForeground: 'hsl(219.4 21% 67.3%)',
    border: 'hsl(220 32.1% 22%)',
    destructive: 'hsl(1.7 64.5% 58%)',
  },
};

export const NAV_THEME: Record<'light' | 'dark', Theme> = {
  light: {
    ...DefaultTheme,
    colors: {
      background: THEME.light.background,
      border: THEME.light.border,
      card: THEME.light.card,
      notification: THEME.light.destructive,
      primary: THEME.light.primary,
      text: THEME.light.foreground,
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      background: THEME.dark.background,
      border: THEME.dark.border,
      card: THEME.dark.card,
      notification: THEME.dark.destructive,
      primary: THEME.dark.primary,
      text: THEME.dark.foreground,
    },
  },
};
