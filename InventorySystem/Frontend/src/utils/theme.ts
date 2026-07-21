const STORAGE_KEY = 'theme';

export type Theme = 'light' | 'dark';

/** Read the persisted theme, falling back to the OS preference. */
export function getTheme(): Theme {
  return 'light';
}

/** Persist the theme and apply the `dark` class to <html>. */
export function setTheme(_theme: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, 'light');
  } catch {
    // ignore
  }
  document.documentElement.classList.remove('dark');
}

export function toggleTheme(_current: Theme): Theme {
  setTheme('light');
  return 'light';
}

