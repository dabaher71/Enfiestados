import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { darkColors, elev, font, lightColors, motion, radius, space } from './tokens';

const STORAGE_KEY = '@enfiestados/theme';

const ThemeContext = createContext(null);

// Construye el objeto de tema completo a partir del modo activo
function buildTheme(mode, systemScheme) {
  const resolved = mode === 'system' ? (systemScheme ?? 'dark') : mode;
  const isDark = resolved === 'dark';
  const colors = isDark ? darkColors : lightColors;
  return { colors, space, radius, font, elev, motion, isDark, resolved };
}

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  // 'light' | 'dark' | 'system'
  const [mode, setMode] = useState('system');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(saved => { if (saved) setMode(saved); })
      .finally(() => setReady(true));
  }, []);

  const setThemeMode = useCallback(async (newMode) => {
    setMode(newMode);
    await AsyncStorage.setItem(STORAGE_KEY, newMode);
  }, []);

  const theme = useMemo(
    () => ({ ...buildTheme(mode, systemScheme), mode, setThemeMode }),
    [mode, systemScheme, setThemeMode]
  );

  // No renderizar hijos hasta leer preferencia guardada (evita flash)
  if (!ready) return null;

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme debe usarse dentro de <ThemeProvider>');
  return ctx;
}
