import { useEffect, useState } from 'react';
import { applyTheme, readTheme, storeTheme, THEME_LABELS, THEMES, type Theme } from '../lib/theme';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => readTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function choose(next: Theme) {
    setTheme(next);
    storeTheme(next);
  }

  return (
    <div className="theme-toggle" role="group" aria-label="Thème d'affichage">
      {THEMES.map((t) => (
        <button key={t} type="button" aria-pressed={theme === t} onClick={() => choose(t)} title={`Thème ${THEME_LABELS[t].toLowerCase()}`}>
          {THEME_LABELS[t]}
        </button>
      ))}
    </div>
  );
}
