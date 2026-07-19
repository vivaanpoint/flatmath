import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
export type AccentTheme = 'blue' | 'emerald' | 'indigo' | 'crimson';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  accentTheme: AccentTheme;
  setAccentTheme: (theme: AccentTheme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return 'dark'; // Dark mode default for premium look
  });

  const [accentTheme, setAccentThemeState] = useState<AccentTheme>(() => {
    const saved = localStorage.getItem('accentTheme');
    if (saved === 'blue' || saved === 'emerald' || saved === 'indigo' || saved === 'crimson') return saved;
    return 'blue'; // default blue
  });

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    if (theme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
      body.classList.add('light');
      body.classList.remove('dark');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
      body.classList.add('dark');
      body.classList.remove('light');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Sync body theme accent class
  useEffect(() => {
    const body = document.body;
    body.classList.remove('theme-blue', 'theme-emerald', 'theme-indigo', 'theme-crimson');
    body.classList.add(`theme-${accentTheme}`);
  }, [accentTheme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const setAccentTheme = (newAccent: AccentTheme) => {
    setAccentThemeState(newAccent);
    localStorage.setItem('accentTheme', newAccent);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, accentTheme, setAccentTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

