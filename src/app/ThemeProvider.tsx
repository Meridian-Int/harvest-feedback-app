import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from 'react';
import { applyTheme, readTheme, type Theme } from '../lib/theme';

const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void } | null>(null);
export function ThemeProvider({ children, initialTheme }: { children: ReactNode; initialTheme?: Theme }) {
  const [theme, setTheme] = useState(initialTheme ?? readTheme);
  useLayoutEffect(() => applyTheme(theme), [theme]);
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('ThemeProvider is required.');
  return context;
}
