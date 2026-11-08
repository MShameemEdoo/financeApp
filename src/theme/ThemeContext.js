import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { View, Appearance, useColorScheme, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { palettes, typographyFor, readableOn } from './palettes';

/**
 * Light / dark theme.
 *   mode  = what the user chose:  'system' (default) | 'light' | 'dark'
 *   scheme = what is actually shown: 'light' | 'dark'
 * 'system' follows the phone's setting live (no restart needed).
 * The choice is saved on THIS device only (it is not part of the finance data that syncs to Drive).
 */
export const THEME_MODES = ['system', 'light', 'dark'];
const STORAGE_KEY = 'theme_mode';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();              // 'light' | 'dark' | null
  const [mode, setModeState] = useState('system');
  const [ready, setReady] = useState(false);

  // Load the saved choice before drawing anything, so there is no flash of the wrong theme
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then(v => { if (alive && THEME_MODES.includes(v)) setModeState(v); })
      .catch(() => {})
      .finally(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);

  // Keep native UI (keyboard, system dialogs) in step with the app when the user forces a theme
  useEffect(() => {
    try { Appearance.setColorScheme(mode === 'system' ? null : mode); } catch (e) { /* older RN: ignore */ }
  }, [mode]);

  const setMode = useCallback(async (next) => {
    if (!THEME_MODES.includes(next)) return;
    setModeState(next);
    try { await AsyncStorage.setItem(STORAGE_KEY, next); } catch (e) { /* non-fatal */ }
  }, []);

  // If the phone reports nothing, keep the app's original dark look
  const scheme = mode === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : mode;

  const value = useMemo(() => {
    const colors = palettes[scheme];
    const isDark = scheme === 'dark';
    return {
      mode, setMode, scheme, isDark, colors,
      typography: typographyFor(colors),
      // a version of a user-chosen colour that is legible as text on a card right now
      readable: (c) => readableOn(c, colors.card, isDark),
    };
  }, [mode, scheme, setMode]);

  if (!ready) {
    const bg = palettes[systemScheme === 'light' ? 'light' : 'dark'].bg;
    return <View style={{ flex: 1, backgroundColor: bg }} />;
  }
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

/**
 * Styles that depend on the theme.  Usage:
 *   const useStyles = createStyles((colors, typography) => ({ box: { backgroundColor: colors.card } }));
 *   function Thing() { const styles = useStyles(); ... }
 * Each palette is built once and cached, so list rows don't rebuild their styles.
 */
export function createStyles(factory) {
  const cache = new WeakMap();
  return function useStyles() {
    const { colors, typography } = useTheme();
    let styles = cache.get(colors);
    if (!styles) {
      styles = StyleSheet.create(factory(colors, typography));
      cache.set(colors, styles);
    }
    return styles;
  };
}
