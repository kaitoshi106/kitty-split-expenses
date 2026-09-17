import { Injectable, effect, signal } from '@angular/core';

export type Theme = 'light' | 'dark' | 'system';

const KEY = 'kitty.theme';
const THEMES: readonly Theme[] = ['light', 'dark', 'system'];

/** Mobile status bar color per theme, matching the top surface. */
const THEME_COLOR = { light: '#6366f1', dark: '#1e2738' } as const;

/**
 * @description Light / dark / system theme. 'system' is the default and follows the OS setting.
 * The service only writes `data-theme` on <html>; styles.css remaps CSS variables from it,
 * so components stay theme-agnostic.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  /** User-selected theme, persisted to localStorage. */
  readonly theme = signal<Theme>(this.read());

  /** Theme actually rendered, with 'system' resolved to light or dark. */
  readonly resolved = signal<'light' | 'dark'>('light');

  constructor() {
    const media = typeof matchMedia === 'function'
      ? matchMedia('(prefers-color-scheme: dark)')
      : null;

    effect(() => {
      const theme = this.theme();
      const resolved = theme === 'system'
        ? (media?.matches ? 'dark' : 'light')
        : theme;
      this.resolved.set(resolved);

      document.documentElement.dataset['theme'] = theme;
      this.setThemeColor(THEME_COLOR[resolved]);

      try {
        localStorage.setItem(KEY, theme);
      } catch {
        /* Storage may be blocked; the theme still applies for this session. */
      }
    });

    // Re-run the effect when the OS scheme changes; only matters for 'system', but harmless otherwise.
    media?.addEventListener('change', () => this.theme.set(this.theme()));
  }

  set(theme: Theme): void {
    this.theme.set(theme);
  }

  private read(): Theme {
    try {
      const saved = localStorage.getItem(KEY) as Theme | null;
      return saved && THEMES.includes(saved) ? saved : 'system';
    } catch {
      return 'system';
    }
  }

  /** @description Updates <meta name="theme-color">, which colors the status bar of an installed PWA. */
  private setThemeColor(color: string): void {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) meta.content = color;
  }
}
