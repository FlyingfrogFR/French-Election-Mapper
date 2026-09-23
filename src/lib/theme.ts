/**
 * Light / dark theme.
 *
 * Three choices: follow the system (the default), always light, always dark. The choice is a
 * per-device convenience, so it lives in localStorage and never leaves the browser — like every
 * other preference here, every access is wrapped because storage can be unavailable (private
 * window, blocked site data) and must never break the page.
 *
 * "auto" removes the attribute entirely, which lets the `prefers-color-scheme` rules in the
 * stylesheet decide; the explicit choices set `data-theme` on <html>.
 */
export const THEMES = ['auto', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_LABELS: Record<Theme, string> = {
  auto: 'Auto',
  light: 'Clair',
  dark: 'Sombre',
};

const KEY = 'boussole2027:v1:theme';

export function readTheme(): Theme {
  try {
    const stored = globalThis.localStorage?.getItem(KEY);
    return (THEMES as readonly string[]).includes(stored ?? '') ? (stored as Theme) : 'auto';
  } catch {
    return 'auto';
  }
}

export function applyTheme(theme: Theme): void {
  const root = globalThis.document?.documentElement;
  if (!root) return;
  if (theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

export function storeTheme(theme: Theme): void {
  try {
    if (theme === 'auto') globalThis.localStorage?.removeItem(KEY);
    else globalThis.localStorage?.setItem(KEY, theme);
  } catch {
    /* the choice still applies for this visit */
  }
}
