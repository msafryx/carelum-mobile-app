import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, borderRadius, typography, ColorScheme } from '@/src/config/theme';

const THEME_STORAGE_KEY = '@carelum:theme';

interface ThemeContextType {
  colors: typeof colors.light;
  colorScheme: ColorScheme;
  isDark: boolean;
  setTheme: (theme: ColorScheme | 'auto') => Promise<void>;
  manualTheme: ColorScheme | 'auto';
  spacing: typeof spacing;
  borderRadius: typeof borderRadius;
  typography: typeof typography;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [manualTheme, setManualTheme] = useState<ColorScheme | 'auto' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'auto')) {
        setManualTheme(savedTheme as ColorScheme | 'auto');
      } else {
        setManualTheme('auto');
      }
    } catch (error) {
      console.error('Error loading theme:', error);
      setManualTheme('auto');
    } finally {
      setLoading(false);
    }
  };

  const setTheme = async (theme: ColorScheme | 'auto') => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, theme);
      setManualTheme(theme);
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  // Determine actual color scheme
  let colorScheme: ColorScheme;
  if (manualTheme === 'auto' || manualTheme === null) {
    colorScheme = systemColorScheme === 'dark' ? 'dark' : 'light';
  } else {
    colorScheme = manualTheme;
  }

  const value: ThemeContextType = {
    colors: colors[colorScheme],
    colorScheme,
    isDark: colorScheme === 'dark',
    spacing,
    borderRadius,
    typography,
    setTheme,
    manualTheme: manualTheme || 'auto',
  };

  if (loading) {
    // Return default light theme while loading
    return (
      <ThemeContext.Provider
        value={{
          colors: colors.light,
          colorScheme: 'light',
          isDark: false,
          spacing,
          borderRadius,
          typography,
          setTheme,
          manualTheme: 'auto',
        }}
      >
        {children}
      </ThemeContext.Provider>
    );
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    // Fallback to light theme if context is not available
    return {
      colors: colors.light,
      colorScheme: 'light' as ColorScheme,
      isDark: false,
      spacing,
      borderRadius,
      typography,
      setTheme: async () => {},
      manualTheme: 'auto' as const,
    };
  }
  return context;
}
