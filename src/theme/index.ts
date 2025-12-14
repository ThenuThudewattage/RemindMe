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
    surface: '#FFFFFF',
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
    primary: '#8B73C8',        // Darker purple for dark mode
    secondary: '#B8A9D4',
    tertiary: '#EFB8C8',
    background: '#0A0A0A',     // Deeper black background
    surface: 'rgba(255, 255, 255, 0.05)',        // Glassmorphism surface
    surfaceVariant: 'rgba(255, 255, 255, 0.08)', // Lighter glass
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
