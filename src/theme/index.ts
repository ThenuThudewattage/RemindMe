// src/theme/index.ts
import { MD3LightTheme as DefaultTheme, MD3Theme } from 'react-native-paper';

export const BRAND = {
  purple: '#6750A4',      // onboarding purple
  purpleDark: '#4E3D87',
  surface: '#FFFBFE',
  surfaceVariant: '#E7E0EC',
};

export const theme: MD3Theme = {
  ...DefaultTheme,
  roundness: 16,
  colors: {
    ...DefaultTheme.colors,
    primary: BRAND.purple,
    secondary: '#625B71',
    tertiary: '#7D5260',
    background: BRAND.surface,
    surface: BRAND.surface,
    surfaceVariant: BRAND.surfaceVariant,
    outline: '#79747E',
    error: '#B3261E',
  },
  // optional type tweaks that look great on hero headers
  fonts: {
    ...DefaultTheme.fonts,
  },
};

export const space = (n: number) => n * 8;
