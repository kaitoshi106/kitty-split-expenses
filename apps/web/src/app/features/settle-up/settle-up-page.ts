import { ChangeDetectionStrategy, Component, computed, effect, inject, input, viewChild } from '@angular/core';
import { UiPageHeader } from '../../ui/ui-page-header/ui-page-header';
import { GroupStore } from '../../core/store/group.store';
import { UiAmount } from '../../ui/ui-amount/ui-amount';
import { UiAvatar } from '../../ui/ui-avatar/ui-avatar';
import { UiButton } from '../../ui/ui-button/ui-button';
import { UiCard } from '../../ui/ui-card/ui-card';
import { UiEmptyState } from '../../ui/ui-empty-state/ui-empty-state';
import { PaymentFormModal } from '../group-shell/payment-form-modal';
import { I18nService } from '../../core/i18n/i18n.service';

/**
 * @description Suggested transfers to settle the group. No money is moved; "mark paid" opens
 * the payment modal prefilled with from/to/amount for the user to confirm and record.
 */
@Component({
  selector: 'app-settle-up-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiPageHeader, UiCard, UiAvatar, UiAmount, UiButton, UiEmptyState, PaymentFormModal],
  template: `
    <main class="flex min-h-dvh flex-col gap-4 px-4 py-4 md:mx-auto md:max-w-2xl">
      <ui-page-header [backLink]="['/g', gid(), 'overview']" [title]="i18n.t('settleUp.title')" />

      @if (store.isSettled()) {
        <ui-empty-state
          icon="🎉"
          [title]="i18n.t('settleUp.allSettled')"
          [message]="i18n.t('settleUp.allSettledHint')"
        />
      } @else {
        <p class="text-sm text-slate-500">
          {{ i18n.t('settleUp.hint', { n: transfers().length }) }}
        </p>

        <div class="grid gap-3 md:grid-cols-2">
          @for (t of transfers(); track t.fromMemberId + t.toMemberId) {
            <ui-card>
              <div class="flex flex-col gap-3">
                <div class="flex items-center justify-center gap-3">
                  <div class="flex flex-col items-center gap-1">
                    <ui-avatar [name]="name(t.fromMemberId)" [color]="color(t.fromMemberId)" />
                    <span class="text-xs text-slate-500">{{ name(t.fromMemberId) }}</span>
                  </div>
                  <span class="text-xl text-slate-300" aria-hidden="true">→</span>
                  <div class="flex flex-col items-center gap-1">
                    <ui-avatar [name]="name(t.toMemberId)" [color]="color(t.toMemberId)" />
                    <span class="text-xs text-slate-500">{{ name(t.toMemberId) }}</span>
                  </div>
                  <div class="ml-2">
                    <ui-amount [minor]="t.amountMinor" [currency]="store.currency()" />
                  </div>
                </div>

                <ui-button variant="secondary" [full]="true" (click)="markPaid(t)">
                  {{ i18n.t('settleUp.markPaid') }}
                </ui-button>
              </div>
            </ui-card>
          }
        </div>
      }

      <app-payment-form-modal #paymentModal />
    </main>
  `,
})
export class SettleUpPage {
  protected readonly i18n = inject(I18nService);

  readonly gid = input.required<string>();

  protected readonly store = inject(GroupStore);
  private readonly paymentModal = viewChild.required(PaymentFormModal);

  /** Derived from balances; refreshes after each recorded payment. */
  protected readonly transfers = computed(() => this.store.settleUp());

  constructor() {
    effect(() => {
      void this.store.ensureLoaded(this.gid());
    });
  }

  protected name(id: string): string {
    return this.store.memberById().get(id)?.name ?? '?';
  }
  protected color(id: string): string {
    return this.store.memberById().get(id)?.avatarColor ?? '#CBD5E1';
  }

  protected markPaid(t: { fromMemberId: string; toMemberId: string; amountMinor: number }): void {
    this.paymentModal().openWith(t.fromMemberId, t.toMemberId, t.amountMinor);
  }
}
