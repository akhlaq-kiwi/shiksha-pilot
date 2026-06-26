import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

const PRESETS = {
  enterprise: { primary: '#10b981', hover: '#059669', rgb: '16, 185, 129', secondary: '#6366f1' },
  fintech:    { primary: '#f59e0b', hover: '#d97706', rgb: '245, 158, 11', secondary: '#10b981' },
  healthcare: { primary: '#0d9488', hover: '#0f766e', rgb: '13, 148, 136', secondary: '#f43f5e' },
};

function applyPreset(preset) {
  const root = window.document.documentElement;
  root.style.removeProperty('--color-primary');
  root.style.removeProperty('--color-primary-hover');
  root.style.removeProperty('--color-primary-rgb');
  root.style.removeProperty('--color-secondary');

  const p = PRESETS[preset];
  if (p) {
    root.style.setProperty('--color-primary', p.primary);
    root.style.setProperty('--color-primary-hover', p.hover);
    root.style.setProperty('--color-primary-rgb', p.rgb);
    root.style.setProperty('--color-secondary', p.secondary);
  }
}

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('shiksha_pilot_theme') || 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('shiksha_pilot_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  // Apply school-scoped theme from logged-in user (only for non-SUPER_ADMIN).
  // Called by the school portals after login with the user's school_portal_theme.
  const applySchoolTheme = (preset) => {
    if (preset && preset !== 'default') applyPreset(preset);
    else applyPreset(null);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, applySchoolTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};

// Standalone helper — used by SchoolDetailPage to preview the swatch colors
export { PRESETS as THEME_PRESET_COLORS };
