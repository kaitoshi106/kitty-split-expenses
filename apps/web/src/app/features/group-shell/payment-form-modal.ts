import { ChangeDetectionStrategy, Component, computed, inject, model, signal } from '@angular/core';
import { GroupStore } from '../../core/store/group.store';
import { UiAvatar } from '../../ui/ui-avatar/ui-avatar';
import { UiButton } from '../../ui/ui-button/ui-button';
import { UiCurrencyInput } from '../../ui/ui-currency-input/ui-currency-input';
import { UiModal } from '../../ui/ui-modal/ui-modal';
import { UiSelect } from '../../ui/ui-select/ui-select';
import { I18nService } from '../../core/i18n/i18n.service';

@Component({
  selector: 'app-payment-form-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiModal, UiButton, UiSelect, UiAvatar, UiCurrencyInput],
  template: `
    <ui-modal [(open)]="open" [title]="i18n.t('paymentForm.title')" (closed)="reset()">
      <div class="flex flex-col gap-5">
        <!-- from → to, with a swap button -->
        <div class="flex items-center justify-center gap-4">
          <div class="flex flex-col items-center gap-2">
            <ui-avatar [name]="fromName()" [color]="fromColor()" size="lg" />
            <ui-select [options]="memberOptions()" [(value)]="fromId" />
          </div>

          <button
            type="button"
            class="mt-2 grid h-10 w-10 shrink-0 place-items-center rounded-full
                   bg-slate-100 text-lg hover:bg-slate-200"
            [attr.aria-label]="i18n.t('paymentForm.swap')"
            (click)="swap()"
          >
            ⇄
          </button>

          <div class="flex flex-col items-center gap-2">
            <ui-avatar [name]="toName()" [color]="toColor()" size="lg" />
            <ui-select [options]="memberOptions()" [(value)]="toId" />
          </div>
        </div>

        <div class="flex flex-col gap-1">
          <span class="text-xs font-semibold uppercase tracking-wide text-slate-400">{{ i18n.t('common.amount') }}</span>
          <!-- Autofocus the amount: openNew() already preselects both members. -->
          <ui-currency-input
            [(minor)]="amountMinor"
            [currency]="store.currency()"
            [autofocus]="true"
          />
        </div>

        <label class="flex flex-col gap-1">
          <span class="text-xs font-semibold uppercase tracking-wide text-slate-400">{{ i18n.t('common.date') }}</span>
          <input
            type="date"
            class="min-h-11 rounded-xl border border-slate-200 px-3 text-sm"
            [value]="date()"
            (input)="date.set($any($event.target).value)"
          />
        </label>

        @if (sameMember()) {
          <p class="text-sm text-debit">{{ i18n.t('paymentForm.sameMember') }}</p>
        }
      </div>

      <div footer class="flex w-full gap-2">
        <ui-button variant="secondary" [full]="true" (click)="open.set(false)">{{
          i18n.t('common.cancel')
        }}</ui-button>
        <ui-button [full]="true" [disabled]="!canSave()" [loading]="saving()" (click)="save()">
          {{ i18n.t('common.save') }}
        </ui-button>
      </div>
    </ui-modal>
  `,
})
export class PaymentFormModal {
  protected readonly i18n = inject(I18nService);

  readonly open = model(false);
  /** Prefill values when opened from the settle-up page. */
  readonly presetFrom = model<string | null>(null);
  readonly presetTo = model<string | null>(null);
  readonly presetAmount = model<number>(0);

  protected readonly store = inject(GroupStore);

  protected readonly fromId = signal<string | null>(null);
  protected readonly toId = signal<string | null>(null);
  protected readonly amountMinor = signal(0);
  protected readonly date = signal(today());
  protected readonly saving = signal(false);

  protected readonly memberOptions = computed(() =>
    this.store.members().map((m) => ({ value: m.id, label: m.name })),
  );

  protected readonly sameMember = computed(
    () => !!this.fromId() && this.fromId() === this.toId(),
  );

  protected readonly canSave = computed(
    () => !!this.fromId() && !!this.toId() && !this.sameMember() && this.amountMinor() > 0,
  );

  private member(id: string | null) {
    return id ? this.store.memberById().get(id) : undefined;
  }
  protected fromName = computed(() => this.member(this.fromId())?.name ?? '?');
  protected fromColor = computed(() => this.member(this.fromId())?.avatarColor ?? '#CBD5E1');
  protected toName = computed(() => this.member(this.toId())?.name ?? '?');
  protected toColor = computed(() => this.member(this.toId())?.avatarColor ?? '#CBD5E1');

  /**
   * @description Opens an empty payment form with both members preselected: the current member
   * as payer and the first other member as recipient. Preselection is required because a
   * `<select>` with no selected option still displays its first option, which would leave the
   * visible choice out of sync with null state (wrong avatar, missed same-member warning,
   * unexplained disabled save).
   */
  openNew(): void {
    const members = this.store.members();
    const from = this.store.currentMemberId() ?? members[0]?.id ?? null;
    this.fromId.set(from);
    this.toId.set(members.find((m) => m.id !== from)?.id ?? null);
    this.amountMinor.set(0);
    this.date.set(today());
    this.open.set(true);
  }

  /**
   * @description Opens the form prefilled with a suggested settle-up transfer.
   * @param fromId - Paying member.
   * @param toId - Receiving member.
   * @param amountMinor - Amount in minor units.
   */
  openWith(fromId: string, toId: string, amountMinor: number): void {
    this.fromId.set(fromId);
    this.toId.set(toId);
    this.amountMinor.set(amountMinor);
    this.date.set(today());
    this.open.set(true);
  }

  protected swap(): void {
    const from = this.fromId();
    this.fromId.set(this.toId());
    this.toId.set(from);
  }

  protected async save(): Promise<void> {
    this.saving.set(true);
    try {
      const created = await this.store.addPayment({
        fromMemberId: this.fromId() as string,
        toMemberId: this.toId() as string,
        amountMinor: this.amountMinor(),
        currency: this.store.currency(),
        paymentDate: this.date(),
      });
      if (created) this.open.set(false);
    } finally {
      this.saving.set(false);
    }
  }

  protected reset(): void {
    this.fromId.set(null);
    this.toId.set(null);
    this.amountMinor.set(0);
    this.date.set(today());
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
