import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { UiPageHeader } from '../../ui/ui-page-header/ui-page-header';
import { currencyCodes } from '@kitty/shared-money';
import { ApiService } from '../../core/api/api.service';
import { SessionStore } from '../../core/session.store';
import { GroupStore } from '../../core/store/group.store';
import { ToastService } from '../../core/toast.service';
import { UiButton } from '../../ui/ui-button/ui-button';
import { UiCard } from '../../ui/ui-card/ui-card';
import { UiSelect } from '../../ui/ui-select/ui-select';
import { UiSwitch } from '../../ui/ui-switch/ui-switch';
import { firstValueFrom } from 'rxjs';
import { I18nService, LANGUAGES } from '../../core/i18n/i18n.service';
import { ThemeService } from '../../core/theme.service';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-settings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, UiPageHeader, UiCard, UiButton, UiSelect, UiSwitch],
  template: `
    <main class="flex min-h-dvh flex-col gap-5 px-4 py-4 md:mx-auto md:max-w-md">
      <ui-page-header [backLink]="['/g', gid(), 'overview']" [title]="i18n.t('settings.title')" />

      <!--
        Language comes first so users who can't read the UI find it immediately.
        It is a per-device setting, not stored on the server.
      -->
      <div class="flex flex-col gap-1">
        <span class="text-xs font-semibold uppercase tracking-wide text-slate-400">{{
          i18n.t('settings.language')
        }}</span>
        <div class="flex gap-2">
          @for (l of languages; track l.code) {
            <button
              type="button"
              class="min-h-11 flex-1 rounded-xl border px-3 text-sm font-medium transition-colors
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              [class]="
                i18n.lang() === l.code
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              "
              [attr.aria-pressed]="i18n.lang() === l.code"
              (click)="i18n.setLang(l.code)"
            >
              {{ l.label }}
            </button>
          }
        </div>
      </div>

      <!-- Theme: also per-device, grouped with language above the group settings. -->
      <div class="flex items-center justify-between gap-3">
        <span class="text-xs font-semibold uppercase tracking-wide text-slate-400">{{
          i18n.t('settings.theme')
        }}</span>
        <ui-switch
          [checked]="isDark()"
          (checkedChange)="toggleDark()"
          [label]="i18n.t('common.darkMode')"
          onIcon="🌙"
          offIcon="☀️"
        />
      </div>

      <label class="flex flex-col gap-1">
        <span class="text-xs font-semibold uppercase tracking-wide text-slate-400">{{
          i18n.t('newGroup.name')
        }}</span>
        <input
          class="min-h-11 rounded-xl border border-slate-200 px-3 text-sm"
          [value]="name()"
          (input)="name.set($any($event.target).value)"
          (blur)="saveName()"
        />
      </label>

      <div class="flex flex-col gap-1">
        <span class="text-xs font-semibold uppercase tracking-wide text-slate-400">{{ i18n.t('common.currency') }}</span>
        <ui-select [options]="currencyOptions" [(value)]="currency" />
      </div>

      <ui-card>
        <label class="flex items-start gap-3">
          <input
            type="checkbox"
            class="mt-1 h-5 w-5 rounded border-slate-300"
            [checked]="simplify()"
            (change)="toggleSimplify($any($event.target).checked)"
          />
          <span>
            <span class="text-sm font-medium">{{ i18n.t('settings.simplify') }}</span>
            <span class="mt-1 block text-xs text-slate-500">
              {{ i18n.t('settings.simplifyOn') }}<br />
              {{ i18n.t('settings.simplifyOff') }}
            </span>
          </span>
        </label>
      </ui-card>

      <section class="flex flex-col gap-2">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {{ i18n.t('settings.categories') }}
          </h2>
          <span class="text-xs text-slate-400">{{ store.categories().length }}</span>
        </div>

        <!--
          Categories render as wrapping chips rather than one row each, and are collapsed
          by default so the section height doesn't grow with the category count.
        -->
        <ui-card>
          <div class="flex flex-wrap gap-2">
            @for (c of visibleCategories(); track c.id) {
              <!--
                [class.x] bindings cannot contain a dot: Angular would bind [class.pr-2.5] as "pr-2",
                which Tailwind never generated. Use whole-step classes for conditional bindings.
              -->
              <span
                class="inline-flex items-center gap-1.5 rounded-full border border-slate-200
                       py-1.5 pl-3 text-sm"
                [class.pr-3]="!c.groupId"
                [class.pr-1]="c.groupId"
              >
                <!-- Color dot instead of c.icon: the icon column holds Lucide names, and no icon library is loaded. -->
                <span
                  class="h-2 w-2 shrink-0 rounded-full"
                  [style.backgroundColor]="c.color"
                  aria-hidden="true"
                ></span>
                <span class="max-w-32 truncate">{{ c.name }}</span>
                @if (c.groupId) {
                  <button
                    type="button"
                    class="grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs
                           text-slate-400 hover:bg-slate-100 hover:text-debit"
                    [attr.aria-label]="i18n.t('settings.removeCategory', { name: c.name })"
                    (click)="removeCategory(c.id)"
                  >✕</button>
                }
              </span>
            }
          </div>

          @if (hiddenCount() > 0) {
            <button
              type="button"
              class="mt-3 text-xs font-medium text-brand-600 hover:underline"
              (click)="showAllCategories.set(true)"
            >
              {{ i18n.t('settings.moreCategories', { n: hiddenCount() }) }}
            </button>
          } @else if (showAllCategories() && store.categories().length > PREVIEW_CATEGORIES) {
            <button
              type="button"
              class="mt-3 text-xs font-medium text-brand-600 hover:underline"
              (click)="showAllCategories.set(false)"
            >
              {{ i18n.t('settings.lessCategories') }}
            </button>
          }

          <div class="mt-3 flex gap-2 border-t border-slate-100 pt-3">
            <input
              class="min-h-11 flex-1 rounded-xl border border-slate-200 px-3 text-sm
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              [placeholder]="i18n.t('settings.newCategory')"
              [value]="newCategory()"
              (input)="newCategory.set($any($event.target).value)"
            />
            <ui-button [disabled]="!newCategory().trim()" (click)="addCategory()">{{
              i18n.t('common.add')
            }}</ui-button>
          </div>
        </ui-card>
      </section>

      <section class="flex flex-col gap-2">
        <h2 class="text-xs font-semibold uppercase tracking-wide text-slate-400">{{ i18n.t('settings.inviteCode') }}</h2>
        <ui-card>
          <div class="flex items-center justify-between gap-3">
            <span class="text-lg font-bold tracking-widest tabular-nums">
              {{ store.group()?.inviteCode }}
            </span>
            <ui-button variant="secondary" size="sm" (click)="regenerate()">{{
              i18n.t('settings.regenerate')
            }}</ui-button>
          </div>
          <p class="mt-2 text-xs text-slate-500">
            {{ i18n.t('settings.regenerateHint') }}
          </p>
        </ui-card>
      </section>

      <!-- History and trash sit just above the danger zone, where users look after an accidental delete. -->
      <section class="flex flex-col gap-2">
        <ui-card [padded]="false">
          <div class="divide-y divide-slate-100">
            <a
              [routerLink]="['/g', gid(), 'activity']"
              class="flex min-h-12 items-center gap-3 px-4 hover:bg-slate-50"
            >
              <span aria-hidden="true">🕘</span>
              <span class="flex-1 text-sm">{{ i18n.t('settings.history') }}</span>
              <span class="text-slate-300" aria-hidden="true">›</span>
            </a>
            <a
              [routerLink]="['/g', gid(), 'trash']"
              class="flex min-h-12 items-center gap-3 px-4 hover:bg-slate-50"
            >
              <span aria-hidden="true">🗑️</span>
              <span class="flex-1 text-sm">{{ i18n.t('settings.trash') }}</span>
              <span class="text-slate-300" aria-hidden="true">›</span>
            </a>
          </div>
        </ui-card>
      </section>

      <section class="flex flex-col gap-2 pt-4">
        <h2 class="text-xs font-semibold uppercase tracking-wide text-debit">{{ i18n.t('settings.danger') }}</h2>
        <ui-button variant="secondary" [full]="true" (click)="leave()">{{
          i18n.t('settings.leave')
        }}</ui-button>
        <ui-button variant="danger" [full]="true" (click)="deleteGroup()">{{
          i18n.t('settings.deleteGroup')
        }}</ui-button>
      </section>
    </main>
  `,
})
export class SettingsPage {
  protected readonly i18n = inject(I18nService);
  protected readonly theme = inject(ThemeService);

  /** Effective theme; follows the OS until the user picks one. */
  protected readonly isDark = computed(() => this.theme.resolved() === 'dark');

  /** Pins the theme explicitly; it stops following the OS from then on. */
  protected toggleDark(): void {
    this.theme.set(this.isDark() ? 'light' : 'dark');
  }

  readonly gid = input.required<string>();

  protected readonly store = inject(GroupStore);
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionStore);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly currencyOptions = currencyCodes().map((c) => ({ value: c, label: c }));
  protected readonly languages = LANGUAGES;
  protected readonly name = signal('');
  protected readonly currency = signal<string | null>('VND');
  protected readonly newCategory = signal('');

  /** Chips shown while collapsed: roughly three rows on a 430px-wide screen. */
  protected readonly PREVIEW_CATEGORIES = 9;

  protected readonly showAllCategories = signal(false);

  protected readonly visibleCategories = computed(() =>
    this.showAllCategories()
      ? this.store.categories()
      : this.store.categories().slice(0, this.PREVIEW_CATEGORIES),
  );

  protected readonly hiddenCount = computed(
    () => this.store.categories().length - this.visibleCategories().length,
  );
  protected readonly simplify = computed(() => this.store.group()?.simplifyDebts ?? true);

  constructor() {
    effect(() => {
      void this.store.ensureLoaded(this.gid());
    });
    // Sync form fields once the group has loaded.
    effect(() => {
      const group = this.store.group();
      if (group) {
        this.name.set(group.name);
        this.currency.set(group.baseCurrency);
      }
    });
  }

  protected async saveName(): Promise<void> {
    const value = this.name().trim();
    if (value && value !== this.store.group()?.name) {
      await this.store.updateGroup({ name: value });
    }
  }

  protected async toggleSimplify(checked: boolean): Promise<void> {
    await this.store.updateGroup({ simplifyDebts: checked });
  }

  protected async addCategory(): Promise<void> {
    await this.store.addCategory(this.newCategory().trim(), 'tag');
    this.newCategory.set('');
  }

  protected async removeCategory(id: string): Promise<void> {
    await this.store.removeCategory(id);
  }

  protected async regenerate(): Promise<void> {
    if (!confirm(this.i18n.t('settings.confirmRegenerate'))) return;
    try {
      const group = await firstValueFrom(this.api.regenerateInviteCode(this.gid()));
      this.store.group.set(group);
      this.toast.success(this.i18n.t('settings.regenerated'));
    } catch {
      /* The HTTP interceptor already surfaced the error. */
    }
  }

  protected async leave(): Promise<void> {
    if (!confirm(this.i18n.t('settings.confirmLeave'))) return;
    this.session.forgetGroup(this.gid());
    this.store.reset();
    await this.router.navigate(['/']);
  }

  protected async deleteGroup(): Promise<void> {
    if (!confirm(this.i18n.t('settings.confirmDelete'))) return;
    try {
      await firstValueFrom(this.api.deleteGroup(this.gid()));
      this.session.forgetGroup(this.gid());
      this.store.reset();
      await this.router.navigate(['/']);
    } catch {
      /* The HTTP interceptor already surfaced the error. */
    }
  }
}
