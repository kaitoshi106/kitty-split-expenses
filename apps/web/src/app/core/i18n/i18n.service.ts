import { Injectable, computed, signal } from '@angular/core';
import { en } from './translations.en';
import { vi, type TranslationKey } from './translations.vi';

export type Lang = 'vi' | 'en';

export const LANGUAGES: { code: Lang; label: string }[] = [
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'en', label: 'English' },
];

const STORAGE_KEY = 'kitty.lang';

/** Vietnamese is the default for the app's primary audience. */
const DEFAULT_LANG: Lang = 'vi';

/**
 * @description Signal-based translation service. Changing `lang` re-renders every
 * template that called `t()`, without a page reload.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  /** Active language, persisted to localStorage. */
  readonly lang = signal<Lang>(readStored());

  constructor() {
    // Sync <html lang> on startup too, so a stored language is reflected for screen readers.
    document.documentElement.lang = this.lang();
  }

  private readonly dict = computed(() => (this.lang() === 'en' ? en : vi));

  /**
   * @description Translates a key, substituting `{name}` placeholders. Reads the `lang`
   * signal, so calling it from a template makes that template react to language changes.
   * @param key - Translation key.
   * @param params - Placeholder values; missing ones are left as `{name}`.
   * @returns The translated string, or the key itself when no entry exists.
   * @example t('join.memberCount', { n: 3 })
   */
  t(key: TranslationKey, params?: Record<string, string | number>): string {
    const template = this.dict()[key] ?? key;
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (_, name: string) =>
      params[name] === undefined ? `{${name}}` : String(params[name]),
    );
  }

  /**
   * @description Translates a backend-defined activity action code (e.g. 'expense.created').
   * Kept separate from `t()` because action codes are not part of TranslationKey;
   * unknown codes fall back to the raw string instead of breaking.
   * @param action - Action code from the activity log.
   * @returns The translated label, or the code itself.
   */
  tAction(action: string): string {
    const dict = this.dict() as Record<string, string>;
    return dict[`activity.action.${action}`] ?? action;
  }

  /** @description Switches language, persists the choice and updates `<html lang>`. */
  setLang(lang: Lang): void {
    this.lang.set(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* Storage may throw in private mode; the choice just won't persist. */
    }
    // Keeps screen reader voice and browser translation prompts correct.
    document.documentElement.lang = lang;
  }
}

function readStored(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'vi' || saved === 'en') return saved;
  } catch {
    /* noop */
  }
  return DEFAULT_LANG;
}
