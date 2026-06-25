import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('shiksha_pilot_theme');
    return saved || 'light'; // Default to light mode as requested
  });

  const [brandPreset, setBrandPreset] = useState(() => {
    return localStorage.getItem('shiksha_pilot_brand') || 'default';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('shiksha_pilot_theme', theme);
  }, [theme]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.style.removeProperty('--color-primary');
    root.style.removeProperty('--color-primary-hover');
    root.style.removeProperty('--color-primary-rgb');
    root.style.removeProperty('--color-secondary');

    if (brandPreset === 'enterprise') {
      root.style.setProperty('--color-primary', '#10b981');
      root.style.setProperty('--color-primary-hover', '#059669');
      root.style.setProperty('--color-primary-rgb', '16, 185, 129');
      root.style.setProperty('--color-secondary', '#6366f1');
    } else if (brandPreset === 'fintech') {
      root.style.setProperty('--color-primary', '#f59e0b');
      root.style.setProperty('--color-primary-hover', '#d97706');
      root.style.setProperty('--color-primary-rgb', '245, 158, 11');
      root.style.setProperty('--color-secondary', '#10b981');
    } else if (brandPreset === 'healthcare') {
      root.style.setProperty('--color-primary', '#0d9488');
      root.style.setProperty('--color-primary-hover', '#0f766e');
      root.style.setProperty('--color-primary-rgb', '13, 148, 136');
      root.style.setProperty('--color-secondary', '#f43f5e');
    }
    localStorage.setItem('shiksha_pilot_brand', brandPreset);
  }, [brandPreset]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, brandPreset, setBrandPreset }}>
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
