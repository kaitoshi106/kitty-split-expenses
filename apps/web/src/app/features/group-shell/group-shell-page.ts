import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { UiBackButton } from '../../ui/ui-back-button/ui-back-button';
import { ExpenseEditorService } from '../../core/expense-editor.service';
import { GroupStore } from '../../core/store/group.store';
import { UiFab, type FabAction } from '../../ui/ui-fab/ui-fab';
import { UiSegmentedTabs } from '../../ui/ui-segmented-tabs/ui-segmented-tabs';
import { ExpenseFormModal } from './expense-form-modal';
import { PaymentFormModal } from './payment-form-modal';
import { PersonFormModal } from './person-form-modal';
import { I18nService } from '../../core/i18n/i18n.service';

/**
 * @description Layout for every /g/:gid/* route. Hosts the expense, payment and member modals
 * so the FAB can open them from any tab.
 */
@Component({
  selector: 'app-group-shell-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiBackButton, 
    RouterOutlet, RouterLink, UiSegmentedTabs, UiFab,
    ExpenseFormModal, PaymentFormModal, PersonFormModal,
  ],
  template: `
    <div class="relative flex min-h-dvh flex-col">
      <!--
        Sticky header. Needs an opaque background or scrolled content shows through.
        z-20 keeps it below the FAB backdrop (z-30) so it dims with the rest of the page.
        Sticky rather than fixed so no padding offset has to track the header height.
      -->
      <header
        class="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-100
               bg-surface px-4 py-3"
      >
        <ui-back-button link="/" [label]="i18n.t('shell.home')" />
        <h1 class="min-w-0 flex-1 truncate text-lg font-semibold">
          {{ store.group()?.name ?? '…' }}
        </h1>
        <span class="shrink-0 text-sm text-slate-400">
          👥 {{ store.members().length }}
        </span>
        <a
          [routerLink]="['/g', gid(), 'settings']"
          class="shrink-0 text-xl text-slate-400"
          [attr.aria-label]="i18n.t('shell.settings')"
        >⚙</a>
      </header>

      <div class="px-4 py-3 md:py-2">
        <ui-segmented-tabs [tabs]="tabs()" [(active)]="activeTab" />
      </div>

      <!--
        Bottom padding reserves space for the floating FAB (bottom-5 + 56px button).
        On desktop the FAB is anchored to the app frame, so less padding is needed.
      -->
      <div class="flex-1 px-4 pb-28 md:pb-20">
        @if (store.loading() && !store.loaded()) {
          <div class="space-y-3 py-6">
            @for (i of [1, 2, 3]; track i) {
              <div class="h-16 animate-pulse rounded-2xl bg-slate-100"></div>
            }
          </div>
        } @else {
          <router-outlet />
        }
      </div>

      <ui-fab [actions]="fabActions()" (actionSelected)="onFabAction($event)" />

      <app-expense-form-modal #expenseModal />
      <app-payment-form-modal #paymentModal />
      <app-person-form-modal #personModal />
    </div>
  `,
})
export class GroupShellPage {
  protected readonly i18n = inject(I18nService);

  /** Bound from the route param via withComponentInputBinding(). */
  readonly gid = input.required<string>();

  protected readonly store = inject(GroupStore);
  private readonly editor = inject(ExpenseEditorService);
  private readonly router = inject(Router);

  private readonly expenseModal = viewChild.required(ExpenseFormModal);
  private readonly paymentModal = viewChild.required(PaymentFormModal);
  private readonly personModal = viewChild.required(PersonFormModal);

  // Computed so labels follow language changes.
  protected readonly tabs = computed(() => [
    { id: 'overview', label: this.i18n.t('shell.tabOverview') },
    { id: 'expenses', label: this.i18n.t('shell.tabExpenses') },
  ]);

  protected readonly fabActions = computed<FabAction[]>(() => [
    {
      id: 'expense',
      label: this.i18n.t('shell.fabExpense'),
      description: this.i18n.t('shell.fabExpenseHint'),
      icon: '🧾',
    },
    {
      id: 'payment',
      label: this.i18n.t('shell.fabPayment'),
      description: this.i18n.t('shell.fabPaymentHint'),
      icon: '💸',
    },
    {
      id: 'person',
      label: this.i18n.t('shell.fabPerson'),
      description: this.i18n.t('shell.fabPersonHint'),
      icon: '👤',
    },
  ]);

  protected readonly activeTab = signal(this.currentTabFromUrl());

  constructor() {
    // Load on entry and whenever the group id changes.
    effect(() => {
      void this.store.ensureLoaded(this.gid());
    });

    // A child tab requested an expense edit: open the shared modal.
    effect(() => {
      const expense = this.editor.pending();
      if (expense) {
        this.expenseModal().openEdit(expense);
        this.editor.consume();
      }
    });

    // Keep the child route in sync with the selected tab.
    effect(() => {
      const tab = this.activeTab();
      if (!this.router.url.includes(`/${tab}`)) {
        void this.router.navigate(['/g', this.gid(), tab]);
      }
    });
  }

  private currentTabFromUrl(): string {
    return inject(Router).url.includes('expenses') ? 'expenses' : 'overview';
  }

  protected onFabAction(id: string): void {
    if (id === 'expense') this.expenseModal().openNew();
    if (id === 'payment') this.paymentModal().openNew();
    if (id === 'person') this.personModal().open.set(true);
  }
}
