// Existing theme colors from the app
export const colors = {
  light: {
    primary: '#7D3DD2',
    primaryDark: '#561CA1',
    background: '#f7f1eb',
    white: '#fff',
    emergency: '#d9534f',
    darkGreen: '#003f2b',
    border: '#e0e0e0',
    borderLight: '#ccc',
    text: '#333',
    textSecondary: '#444',
    textDark: '#000',
    error: '#d9534f',
    success: '#5cb85c',
    warning: '#f0ad4e',
    info: '#5bc0de',
  },
  dark: {
    primary: '#9D5DF2',
    primaryDark: '#7D3DD2',
    background: '#1a1a1a',
    white: '#2a2a2a',
    emergency: '#ff6b6b',
    darkGreen: '#00d4aa',
    border: '#3a3a3a',
    borderLight: '#4a4a4a',
    text: '#e0e0e0',
    textSecondary: '#b0b0b0',
    textDark: '#fff',
    error: '#ff6b6b',
    success: '#51cf66',
    warning: '#ffd43b',
    info: '#74c0fc',
    orange: '#ff8c42', // Orange color for logo in dark mode
  },
};

export type ColorScheme = 'light' | 'dark';
export type Theme = typeof colors.light;

// Re-export useTheme from ThemeProvider
export { useTheme } from '@/src/components/ui/ThemeProvider';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 10,
  md: 15,
  lg: 20,
  xl: 30,
  full: 9999,
};

export const typography = {
  h1: {
    fontSize: 28,
    fontWeight: 'bold' as const,
  },
  h2: {
    fontSize: 24,
    fontWeight: '700' as const,
  },
  h3: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
  },
  bodyBold: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  caption: {
    fontSize: 14,
    fontWeight: '400' as const,
  },
  small: {
    fontSize: 12,
    fontWeight: '400' as const,
  },
};
