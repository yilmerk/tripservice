import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from 'react';

export type Theme = 'light' | 'dark';
export const THEME_STORAGE_KEY = 'rota-theme';
const SYSTEM_QUERY = '(prefers-color-scheme: dark)';
function parsePreference(value: string | null): Theme | null {
  return value === 'dark' || value === 'light' ? value : null;
}
function readPreference(): Theme | null {
  try { return parsePreference(localStorage.getItem(THEME_STORAGE_KEY)); } catch { return null; }
}
const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void } | undefined>(undefined);
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<Theme | null>(readPreference);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.(SYSTEM_QUERY).matches ?? false);
  const theme: Theme = preference ?? (systemDark ? 'dark' : 'light');
  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0f172a' : '#fafbf8');
  }, [theme]);
  useEffect(() => {
    const media = window.matchMedia?.(SYSTEM_QUERY);
    const onSystemChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    setSystemDark(media?.matches ?? false);
    media?.addEventListener('change', onSystemChange);
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) setPreference(parsePreference(event.newValue));
    };
    window.addEventListener('storage', onStorage);
    return () => { media?.removeEventListener('change', onSystemChange); window.removeEventListener('storage', onStorage); };
  }, []);
  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setPreference(next);
    try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch { /* Keep the session usable without storage. */ }
  }
  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme, ThemeProvider içinde kullanılmalıdır.');
  return context;
}
