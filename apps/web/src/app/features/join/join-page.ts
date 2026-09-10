import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { UiBackButton } from '../../ui/ui-back-button/ui-back-button';
import type { LookupGroupResult } from '@kitty/shared-types';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { SessionStore } from '../../core/session.store';
import { GroupStore } from '../../core/store/group.store';
import { UiAvatar } from '../../ui/ui-avatar/ui-avatar';
import { UiButton } from '../../ui/ui-button/ui-button';
import { I18nService } from '../../core/i18n/i18n.service';

/**
 * @description Two-step join flow without accounts:
 *   1. lookup: preview the group by invite code (no token yet);
 *   2. claim: pick an existing member or add a new one, which issues the token.
 * Lookup returns member names only, so no financial data is exposed before claiming.
 */
@Component({
  selector: 'app-join-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiBackButton, UiAvatar, UiButton],
  template: `
    <main class="flex min-h-dvh flex-col gap-6 px-4 py-6 md:mx-auto md:max-w-md">
      <header class="flex items-center gap-3">
        <ui-back-button link="/" />
        <h1 class="text-lg font-semibold">{{ i18n.t('join.title') }}</h1>
      </header>

      @if (!preview()) {
        <!-- Step 1: enter code -->
        <div class="flex flex-col gap-4">
          <p class="text-sm text-slate-500">{{ i18n.t('join.enterCode') }}</p>
          <input
            class="min-h-14 rounded-xl border border-slate-200 px-4 text-center text-2xl
                   font-bold uppercase tracking-[0.3em] focus-visible:outline-none
                   focus-visible:ring-2 focus-visible:ring-brand-500"
            [value]="typed()"
            maxlength="8"
            autocapitalize="characters"
            autocomplete="off"
            spellcheck="false"
            placeholder="K7M2XQ9P"
            (input)="onCodeInput($event)"
          />
          <ui-button
            size="lg"
            [full]="true"
            [disabled]="typed().length < 4"
            [loading]="loading()"
            (click)="lookup()"
          >
            {{ i18n.t('join.find') }}
          </ui-button>
          @if (error()) {
            <p class="text-center text-sm text-debit">{{ error() }}</p>
          }
        </div>
      } @else {
        <!-- Step 2: pick a member -->
        <div class="flex flex-col gap-4">
          <div class="text-center">
            <h2 class="text-xl font-bold">{{ preview()!.group.name }}</h2>
            <p class="text-sm text-slate-500">
              {{ i18n.t('join.memberCount', { n: preview()!.members.length }) }}
            </p>
          </div>

          <p class="text-center text-sm font-medium text-slate-700">{{ i18n.t('join.whoAreYou') }}</p>

          <div class="flex flex-col gap-1">
            @for (m of preview()!.members; track m.id) {
              <button
                type="button"
                class="flex min-h-12 items-center gap-3 rounded-xl px-3 text-left
                       hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2
                       focus-visible:ring-brand-500"
                [disabled]="claiming()"
                (click)="claim(m.id)"
              >
                <ui-avatar [name]="m.name" [color]="m.avatarColor" />
                <span class="flex-1 text-sm font-medium">{{ m.name }}</span>
                <span class="text-slate-300" aria-hidden="true">›</span>
              </button>
            }
          </div>

          <div class="border-t border-slate-100 pt-4">
            @if (!addingNew()) {
              <ui-button variant="ghost" [full]="true" (click)="addingNew.set(true)">
                {{ i18n.t('join.imNew') }}
              </ui-button>
            } @else {
              <div class="flex gap-2">
                <input
                  class="min-h-11 flex-1 rounded-xl border border-slate-200 px-3 text-sm
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  [placeholder]="i18n.t('join.yourName')"
                  [value]="newName()"
                  (input)="newName.set($any($event.target).value)"
                />
                <ui-button
                  [disabled]="!newName().trim()"
                  [loading]="claiming()"
                  (click)="claimNew()"
                >
                  {{ i18n.t('join.enter') }}
                </ui-button>
              </div>
            }
          </div>
        </div>
      }
    </main>
  `,
})
export class JoinPage {
  protected readonly i18n = inject(I18nService);

  /** Bound from the '/join/:code' route param; the name must match the param. */
  readonly code = input<string | undefined>(undefined);

  private readonly api = inject(ApiService);
  private readonly session = inject(SessionStore);
  private readonly store = inject(GroupStore);
  private readonly router = inject(Router);

  protected readonly typed = signal('');
  protected readonly preview = signal<LookupGroupResult | null>(null);
  protected readonly loading = signal(false);
  protected readonly claiming = signal(false);
  protected readonly error = signal('');
  protected readonly addingNew = signal(false);
  protected readonly newName = signal('');

  constructor() {
    // Opened from a QR link ('/join/K7M2XQ9P'): prefill the code and look it up.
    effect(() => {
      const fromUrl = this.code();
      if (fromUrl && !this.preview()) {
        this.typed.set(fromUrl.toUpperCase());
        void this.lookup();
      }
    });
  }

  /**
   * @description Normalizes the invite code to uppercase letters and digits, preserving the caret.
   * Writes back to `input.value` directly: when a rejected character is typed the signal value
   * doesn't change, so the [value] binding wouldn't update the DOM.
   */
  protected onCodeInput(event: Event): void {
    const el = event.target as HTMLInputElement;
    const cleaned = el.value.toUpperCase().replace(/[^0-9A-Z]/g, '');

    if (cleaned !== el.value) {
      const caret = el.selectionStart ?? cleaned.length;
      const removedBefore =
        caret - el.value.slice(0, caret).toUpperCase().replace(/[^0-9A-Z]/g, '').length;
      el.value = cleaned;
      const next = Math.max(0, caret - removedBefore);
      el.setSelectionRange(next, next);
    }

    this.typed.set(cleaned);
    this.error.set('');
  }

  protected async lookup(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      this.preview.set(await firstValueFrom(this.api.lookupGroup(this.typed())));
    } catch {
      this.error.set(this.i18n.t('join.notFound'));
    } finally {
      this.loading.set(false);
    }
  }

  protected claim(memberId: string): Promise<void> {
    return this.doClaim({ memberId });
  }

  protected claimNew(): Promise<void> {
    return this.doClaim({ newMemberName: this.newName().trim() });
  }

  private async doClaim(dto: { memberId?: string; newMemberName?: string }): Promise<void> {
    const groupId = this.preview()?.group.id;
    if (!groupId) return;

    this.claiming.set(true);
    try {
      const result = await firstValueFrom(this.api.claimMember(groupId, dto));
      this.session.setToken(groupId, result.token);
      this.session.rememberGroup(groupId, result.group.name, result.group.createdAt);
      this.store.setCurrentMember(result.member.id, result.member.role);
      await this.router.navigate(['/g', groupId, 'overview']);
    } finally {
      this.claiming.set(false);
    }
  }
}
