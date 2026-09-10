import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SessionStore } from '../../core/session.store';
import { UiButton } from '../../ui/ui-button/ui-button';
import { UiCard } from '../../ui/ui-card/ui-card';
import { UiSelect } from '../../ui/ui-select/ui-select';
import { UiSwitch } from '../../ui/ui-switch/ui-switch';
import { I18nService, LANGUAGES, type Lang } from '../../core/i18n/i18n.service';
import { ThemeService } from '../../core/theme.service';

/**
 * @description Landing page; the only screen that works without a group token. The /g/:gid/*
 * guard redirects token-less visitors here via /join.
 */
@Component({
  selector: 'app-welcome-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, UiButton, UiCard, UiSelect, UiSwitch],
  template: `
    <main class="flex min-h-dvh flex-col gap-8 px-4 py-6 md:mx-auto md:max-w-md">
      <!--
        Language and theme are exposed here as well as in group settings: first-time
        users have no group yet and may need to switch language before creating one.
      -->
      <div class="flex items-center justify-between gap-3">
        <ui-select
          class="w-40"
          [options]="langOptions"
          [value]="i18n.lang()"
          (valueChange)="setLang($event)"
        />

        <ui-switch
          [checked]="isDark()"
          (checkedChange)="toggleDark()"
          [label]="i18n.t('common.darkMode')"
          onIcon="🌙"
          offIcon="☀️"
        />
      </div>

      <div class="text-center">
        <div class="text-6xl" aria-hidden="true">🐱</div>
        <h1 class="mt-3 text-3xl font-bold text-brand-600">Kitty</h1>
        <p class="mt-1 text-sm text-slate-500">{{ i18n.t('welcome.tagline') }}</p>
      </div>

      <div class="flex flex-col gap-3">
        <a routerLink="/new-group" class="contents">
          <ui-button size="lg" [full]="true">{{ i18n.t('welcome.newGroup') }}</ui-button>
        </a>
        <a routerLink="/join" class="contents">
          <ui-button variant="secondary" size="lg" [full]="true">{{ i18n.t('welcome.joinGroup') }}</ui-button>
        </a>
      </div>

      @if (session.recentGroups().length > 0) {
        <section class="flex flex-col gap-2">
          <h2 class="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {{ i18n.t('welcome.recent') }}
          </h2>
          @for (g of session.recentGroups(); track g.id) {
            <!-- The remove button sits beside the link: a button nested in <a> is invalid HTML. -->
            <div class="flex items-stretch gap-2">
              <a [routerLink]="['/g', g.id, 'overview']" class="block min-w-0 flex-1">
                <ui-card [clickable]="true">
                  <div class="flex items-center justify-between gap-3">
                    <div class="min-w-0 flex-1">
                      <span class="block truncate text-sm font-medium">{{ g.name }}</span>
                      @if (g.createdAt) {
                        <span class="block text-xs text-slate-400">
                          {{ i18n.t('welcome.createdOn', { date: formatDate(g.createdAt) }) }}
                        </span>
                      }
                    </div>
                    <span class="shrink-0 text-slate-300" aria-hidden="true">›</span>
                  </div>
                </ui-card>
              </a>
              <button
                type="button"
                class="grid w-10 shrink-0 place-items-center rounded-xl text-slate-300
                       hover:bg-slate-100 hover:text-debit focus-visible:outline-none
                       focus-visible:ring-2 focus-visible:ring-brand-500"
                [attr.aria-label]="i18n.t('welcome.forget', { name: g.name })"
                (click)="forget(g.id, g.name)"
              >
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2" stroke-linecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          }
        </section>
      }
    </main>
  `,
})
export class WelcomePage {
  protected readonly i18n = inject(I18nService);
  protected readonly session = inject(SessionStore);
  protected readonly theme = inject(ThemeService);

  protected readonly langOptions = LANGUAGES.map((l) => ({ value: l.code, label: l.label }));

  /** Effective theme, with "system" already resolved to light or dark. */
  protected readonly isDark = computed(() => this.theme.resolved() === 'dark');

  protected setLang(code: string | null): void {
    if (code === 'vi' || code === 'en') this.i18n.setLang(code as Lang);
  }

  /**
   * @description Pins the theme to the opposite of what is currently shown. Until toggled the app
   * follows the OS setting; "system" is the default behavior, not a third switch position.
   */
  protected toggleDark(): void {
    this.theme.set(this.isDark() ? 'light' : 'dark');
  }

  /**
   * @description Removes a group and its access token from this device after confirmation.
   * Uses a confirm dialog rather than an undo toast: without the token the only way back is an
   * invite code, which lives inside the group itself. The group is not deleted on the server.
   * @param groupId - Group to forget.
   * @param name - Group name shown in the confirmation.
   */
  protected forget(groupId: string, name: string): void {
    if (!confirm(this.i18n.t('welcome.forgetConfirm', { name }))) return;
    this.session.forgetGroup(groupId);
  }

  /**
   * @description Formats a date for the active language. Reading `i18n.lang()` makes the template
   * re-render when the language changes.
   * @param iso - ISO 8601 timestamp.
   */
  protected formatDate(iso: string): string {
    const locale = this.i18n.lang() === 'en' ? 'en-GB' : 'vi-VN';
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(iso));
  }
}
