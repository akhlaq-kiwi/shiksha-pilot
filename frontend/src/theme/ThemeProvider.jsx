import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext({
  theme: 'light',
  toggleTheme: () => {},
  setTheme: () => {}
});

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => {
    return localStorage.getItem('sp-theme') || 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    
    // Clean up classes
    root.classList.remove('dark-theme', 'light-theme');
    body.classList.remove('dark-theme', 'light-theme');

    if (theme === 'dark') {
      root.classList.add('dark-theme');
      body.classList.add('dark-theme');
      // For Tailwind darkMode class:
      root.classList.add('dark');
    } else {
      root.classList.add('light-theme');
      body.classList.add('light-theme');
      root.classList.remove('dark');
    }

    localStorage.setItem('sp-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setThemeState(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const setTheme = (newTheme) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
