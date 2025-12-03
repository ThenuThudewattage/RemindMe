// src/theme/index.ts
import { MD3LightTheme, MD3DarkTheme, MD3Theme } from 'react-native-paper';

export const BRAND = {
  purple: '#6750A4',      // onboarding purple
  purpleDark: '#4E3D87',
  surface: '#FFFBFE',
  surfaceVariant: '#E7E0EC',
};

export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  roundness: 16,
  colors: {
    ...MD3LightTheme.colors,
    primary: BRAND.purple,
    secondary: '#625B71',
    tertiary: '#7D5260',
    background: BRAND.surface,
    surface: BRAND.surface,
    surfaceVariant: BRAND.surfaceVariant,
    outline: '#79747E',
    error: '#B3261E',
  },
  fonts: {
    ...MD3LightTheme.fonts,
  },
};

export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  roundness: 16,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#D0BCFF',        // Lighter purple for dark mode
    secondary: '#CCC2DC',
    tertiary: '#EFB8C8',
    background: '#1C1B1F',     // Dark background
    surface: '#1C1B1F',
    surfaceVariant: '#49454F',
    outline: '#938F99',
    error: '#F2B8B5',
  },
  fonts: {
    ...MD3DarkTheme.fonts,
  },
};

// For backwards compatibility
export const theme = lightTheme;

export const space = (n: number) => n * 8;
