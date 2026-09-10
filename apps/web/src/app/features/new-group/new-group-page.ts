import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UiBackButton } from '../../ui/ui-back-button/ui-back-button';
import { currencyCodes } from '@kitty/shared-money';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { SessionStore } from '../../core/session.store';
import { GroupStore } from '../../core/store/group.store';
import { UiButton } from '../../ui/ui-button/ui-button';
import { UiSelect } from '../../ui/ui-select/ui-select';
import { I18nService } from '../../core/i18n/i18n.service';

@Component({
  selector: 'app-new-group-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiBackButton, FormsModule, UiButton, UiSelect],
  template: `
    <main class="flex min-h-dvh flex-col gap-6 px-4 py-6 md:mx-auto md:max-w-md">
      <header class="flex items-center gap-3">
        <ui-back-button link="/" />
        <h1 class="text-lg font-semibold">{{ i18n.t('newGroup.title') }}</h1>
      </header>

      <label class="flex flex-col gap-1">
        <span class="text-xs font-semibold uppercase tracking-wide text-slate-400">{{ i18n.t('newGroup.name') }}</span>
        <input
          class="min-h-11 rounded-xl border border-slate-200 px-3 text-sm
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          [(ngModel)]="name"
          name="groupName"
          [placeholder]="i18n.t('newGroup.namePlaceholder')"
          maxlength="100"
        />
      </label>

      <div class="flex flex-col gap-1">
        <span class="text-xs font-semibold uppercase tracking-wide text-slate-400">{{ i18n.t('common.currency') }}</span>
        <ui-select [options]="currencyOptions" [(value)]="currency" />
      </div>

      <section class="flex flex-col gap-2">
        <span class="text-xs font-semibold uppercase tracking-wide text-slate-400">{{ i18n.t('newGroup.members') }}</span>

        @for (member of members(); track $index) {
          <div class="flex items-center gap-2">
            <input
              class="min-h-11 flex-1 rounded-xl border border-slate-200 px-3 text-sm
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              [value]="member"
              [attr.placeholder]="i18n.t($index === 0 ? 'newGroup.yourName' : 'newGroup.memberName')"
              (input)="setMember($index, $any($event.target).value)"
            />
            @if ($index === 0) {
              <span class="w-16 shrink-0 text-xs text-slate-400">{{ i18n.t('common.you') }}</span>
            } @else {
              <button
                type="button"
                class="grid h-11 w-16 shrink-0 place-items-center rounded-xl text-slate-400
                       hover:bg-slate-50"
                [attr.aria-label]="i18n.t('newGroup.removeMember', { name: member })"
                (click)="removeMember($index)"
              >
                ✕
              </button>
            }
          </div>
        }

        <ui-button variant="secondary" [full]="true" (click)="addMember()">
          {{ i18n.t('newGroup.addPerson') }}
        </ui-button>
      </section>

      @if (error()) {
        <p class="text-sm text-debit">{{ error() }}</p>
      }

      <ui-button
        size="lg"
        [full]="true"
        [disabled]="!canSubmit()"
        [loading]="saving()"
        (click)="submit()"
      >
        {{ i18n.t('newGroup.submit') }}
      </ui-button>
    </main>
  `,
})
export class NewGroupPage {
  protected readonly i18n = inject(I18nService);

  private readonly api = inject(ApiService);
  private readonly session = inject(SessionStore);
  private readonly store = inject(GroupStore);
  private readonly router = inject(Router);

  protected readonly name = signal('');
  protected readonly currency = signal<string | null>('VND');
  protected readonly members = signal<string[]>(['', '']);
  protected readonly saving = signal(false);
  protected readonly error = signal('');

  protected readonly currencyOptions = currencyCodes().map((code) => ({
    value: code,
    label: code,
  }));

  /** Requires a group name and at least one non-empty member name. */
  protected readonly canSubmit = computed(
    () => this.name().trim().length > 0 && this.filledMembers().length > 0,
  );

  private filledMembers(): string[] {
    return this.members().map((m) => m.trim()).filter(Boolean);
  }

  protected setMember(index: number, value: string): void {
    this.members.update((list) => list.map((m, i) => (i === index ? value : m)));
  }

  protected addMember(): void {
    this.members.update((list) => [...list, '']);
  }

  protected removeMember(index: number): void {
    this.members.update((list) => list.filter((_, i) => i !== index));
  }

  protected async submit(): Promise<void> {
    const names = this.filledMembers();
    const lower = names.map((n) => n.toLowerCase());
    if (new Set(lower).size !== lower.length) {
      this.error.set(this.i18n.t('newGroup.duplicateName'));
      return;
    }
    this.error.set('');
    this.saving.set(true);
    try {
      const result = await firstValueFrom(
        this.api.createGroup({
          name: this.name().trim(),
          baseCurrency: this.currency() ?? 'VND',
          memberNames: names,
        }),
      );
      // Store the token before navigating; the /g/:gid guard checks it immediately.
      this.session.setToken(result.group.id, result.token);
      this.session.rememberGroup(result.group.id, result.group.name, result.group.createdAt);
      this.store.setCurrentMember(result.member.id, result.member.role);
      await this.router.navigate(['/g', result.group.id, 'overview']);
    } finally {
      this.saving.set(false);
    }
  }
}
