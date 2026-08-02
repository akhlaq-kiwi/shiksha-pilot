import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

/**
 * School-selectable portal themes.
 *
 * Replaces the previous `enterprise` / `fintech` / `healthcare` presets, which
 * used vocabulary no school buyer recognises and set only four variables — so
 * tinted backgrounds, focus rings and charts didn't follow the brand colour.
 *
 * Each preset now emits the FULL ramp, so `bg-primary/10` tints, `ring-primary`
 * focus states and chart strokes all re-skin coherently. Maroon and navy in
 * particular match real South-Asian school crests.
 *
 * Every `600` value below clears 4.5:1 against white, so white-on-primary
 * buttons and primary-on-white text stay AA-compliant in any theme.
 */
export const THEME_PRESETS = {
  indigo: {
    label: 'Scholar Indigo',
    ramp: { 50: '#EEF2FF', 100: '#E0E7FF', 200: '#C7D2FE', 300: '#A5B4FC', 400: '#818CF8', 500: '#6366F1', 600: '#4F46E5', 700: '#4338CA', 800: '#3730A3', 900: '#312E81' },
  },
  teal: {
    label: 'Academy Teal',
    ramp: { 50: '#F0FDFA', 100: '#CCFBF1', 200: '#99F6E4', 300: '#5EEAD4', 400: '#2DD4BF', 500: '#14B8A6', 600: '#0D9488', 700: '#0F766E', 800: '#115E59', 900: '#134E4A' },
  },
  maroon: {
    label: 'Heritage Maroon',
    ramp: { 50: '#FEF2F2', 100: '#FEE2E2', 200: '#FECACA', 300: '#FCA5A5', 400: '#F87171', 500: '#B91C1C', 600: '#991B1B', 700: '#7F1D1D', 800: '#6B1717', 900: '#521111' },
  },
  navy: {
    label: 'Classic Navy',
    ramp: { 50: '#EFF6FF', 100: '#DBEAFE', 200: '#BFDBFE', 300: '#93C5FD', 400: '#60A5FA', 500: '#2563EB', 600: '#1D4ED8', 700: '#1E40AF', 800: '#1E3A8A', 900: '#172554' },
  },
  forest: {
    label: 'Forest Green',
    ramp: { 50: '#F0FDF4', 100: '#DCFCE7', 200: '#BBF7D0', 300: '#86EFAC', 400: '#4ADE80', 500: '#16A34A', 600: '#15803D', 700: '#166534', 800: '#14532D', 900: '#052E16' },
  },
};

const hexToRgb = (hex) => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(', ');
};

const RAMP_STOPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

const OVERRIDDEN_PROPS = [
  ...RAMP_STOPS.map((s) => `--brand-${s}`),
  '--color-primary',
  '--color-primary-hover',
  '--color-primary-active',
  '--color-primary-subtle',
  '--color-primary-rgb',
];

function applyPreset(presetKey, isDark) {
  const root = window.document.documentElement;

  // Always clear first so switching themes never leaves a stale stop behind.
  OVERRIDDEN_PROPS.forEach((prop) => root.style.removeProperty(prop));

  const preset = THEME_PRESETS[presetKey];
  if (!preset) return; // 'default' → fall through to the tokens in index.css

  const { ramp } = preset;
  RAMP_STOPS.forEach((stop) => root.style.setProperty(`--brand-${stop}`, ramp[stop]));

  // Dark mode needs the lighter stops to stay legible against the navy canvas.
  const base = isDark ? ramp[400] : ramp[600];
  const hover = isDark ? ramp[300] : ramp[700];
  const active = isDark ? ramp[200] : ramp[800];

  root.style.setProperty('--color-primary', base);
  root.style.setProperty('--color-primary-hover', hover);
  root.style.setProperty('--color-primary-active', active);
  root.style.setProperty('--color-primary-subtle', isDark ? `rgba(${hexToRgb(base)}, 0.15)` : ramp[50]);
  root.style.setProperty('--color-primary-rgb', hexToRgb(base));
}

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem('shiksha_pilot_theme');
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    return 'system';
  });

  // The school preset currently applied, kept so we can re-apply it when
  // light/dark flips (the ramp stop we use depends on the mode).
  const [schoolPreset, setSchoolPreset] = useState(null);

  /** The concrete mode in effect once `system` is resolved. */
  const resolvedTheme = useResolvedTheme(theme);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.toggle('dark', resolvedTheme === 'dark');
    root.style.colorScheme = resolvedTheme;
    localStorage.setItem('shiksha_pilot_theme', theme);
  }, [theme, resolvedTheme]);

  // Re-apply the school ramp whenever the preset or the light/dark mode changes.
  useEffect(() => {
    applyPreset(schoolPreset, resolvedTheme === 'dark');
  }, [schoolPreset, resolvedTheme]);

  const toggleTheme = () =>
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');

  /**
   * Apply the school-scoped theme for the logged-in user.
   * Accepts a preset key; anything unknown (including 'default') resets to the
   * built-in Scholar Indigo tokens.
   */
  const applySchoolTheme = (preset) => {
    setSchoolPreset(THEME_PRESETS[preset] ? preset : null);
  };

  return (
    <ThemeContext.Provider
      value={{ theme, resolvedTheme, setTheme, toggleTheme, applySchoolTheme, schoolPreset }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

/** Resolves 'system' against the OS preference and keeps tracking changes. */
function useResolvedTheme(theme) {
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  );

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const onChange = (e) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  if (theme === 'system') return systemDark ? 'dark' : 'light';
  return theme;
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};

/** Swatch colours for the theme picker in school settings. */
export const THEME_PRESET_COLORS = Object.fromEntries(
  Object.entries(THEME_PRESETS).map(([key, { label, ramp }]) => [
    key,
    { label, primary: ramp[600], hover: ramp[700], rgb: hexToRgb(ramp[600]), secondary: ramp[100] },
  ])
);
