export type ThemeMode = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'portale-pa-theme-mode';

export const themeTokens = {
  typography: {
    fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
    sizeXs: '0.75rem',
    sizeSm: '0.875rem',
    sizeMd: '1rem',
    sizeLg: '1.25rem',
    sizeXl: '1.6rem',
    weightRegular: '400',
    weightMedium: '500',
    weightSemibold: '600',
    weightBold: '700'
  },
  spacing: {
    xxs: '4px',
    xs: '8px',
    sm: '12px',
    md: '16px',
    lg: '20px',
    xl: '24px'
  },
  radius: {
    sm: '10px',
    md: '14px',
    lg: '18px',
    pill: '999px'
  },
  shadow: {
    sm: '0 2px 10px rgba(9, 33, 61, 0.08)',
    md: '0 8px 22px rgba(9, 33, 61, 0.12)'
  },
  motion: {
    fast: '140ms',
    normal: '220ms'
  }
};

export const themePalettes: Record<ThemeMode, Record<string, string>> = {
  light: {
    '--color-bg': '#eef2f7',
    '--color-surface': '#ffffff',
    '--color-surface-soft': '#f8fbff',
    '--color-surface-muted': '#f4f7fb',
    '--color-border': '#d6e0ec',
    '--color-border-strong': '#c2cfe0',
    '--color-text': '#1f2937',
    '--color-text-muted': '#4b5f79',
    '--color-primary': '#0f4d8a',
    '--color-primary-soft': '#eaf2fb',
    '--color-primary-contrast': '#ffffff',
    '--color-warning-bg': '#fff8eb',
    '--color-warning-text': '#8a4b08',
    '--color-success-bg': '#edf7ef',
    '--color-success-text': '#0f5132',
    '--color-danger-text': '#b42318',
    '--gradient-app-bg': 'linear-gradient(180deg, #f5f8fc 0%, var(--color-bg) 220px)',
    '--gradient-wizard': 'linear-gradient(180deg, #fcfdff 0%, #f6f9fe 100%)',
    '--gradient-card-elevated': 'linear-gradient(180deg, #ffffff 0%, var(--color-surface-soft) 100%)',
    '--shadow-nav': '0 -8px 24px rgba(17, 38, 66, 0.08)'
  },
  dark: {
    '--color-bg': '#0b1220',
    '--color-surface': '#121b2d',
    '--color-surface-soft': '#17253a',
    '--color-surface-muted': '#1b2a3e',
    '--color-border': '#243650',
    '--color-border-strong': '#2f4667',
    '--color-text': '#e4eaf4',
    '--color-text-muted': '#9eb0c9',
    '--color-primary': '#73a8e6',
    '--color-primary-soft': '#203654',
    '--color-primary-contrast': '#0a1321',
    '--color-warning-bg': '#3a2b12',
    '--color-warning-text': '#f0c27b',
    '--color-success-bg': '#123325',
    '--color-success-text': '#94dfb5',
    '--color-danger-text': '#ff8a80',
    '--gradient-app-bg': 'linear-gradient(180deg, #0f1b2d 0%, var(--color-bg) 220px)',
    '--gradient-wizard': 'linear-gradient(180deg, #16253a 0%, #0f1d32 100%)',
    '--gradient-card-elevated': 'linear-gradient(180deg, #182741 0%, var(--color-surface-soft) 100%)',
    '--shadow-nav': '0 -8px 24px rgba(0, 0, 0, 0.45)'
  }
};

export function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  root.dataset.theme = mode;
  Object.entries(themePalettes[mode]).forEach(([token, value]) => {
    root.style.setProperty(token, value);
  });
}

export function getInitialTheme(): ThemeMode {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return 'light';
}
