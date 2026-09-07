import { useEffect, useState } from 'react'
import { applyTheme, readTheme, saveTheme, type Theme } from '../lib/theme'

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document === 'undefined' ? 'light' : readTheme(),
  )

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  function choose(next: Theme) {
    setTheme(next)
    saveTheme(next)
  }

  return (
    <div className={`theme-widget${compact ? ' is-compact' : ''}`} role="group" aria-label="Color theme">
      <button
        type="button"
        className={theme === 'light' ? 'is-on' : ''}
        aria-pressed={theme === 'light'}
        onClick={() => choose('light')}
      >
        Light
      </button>
      <button
        type="button"
        className={theme === 'dark' ? 'is-on' : ''}
        aria-pressed={theme === 'dark'}
        onClick={() => choose('dark')}
      >
        Dark
      </button>
    </div>
  )
}
