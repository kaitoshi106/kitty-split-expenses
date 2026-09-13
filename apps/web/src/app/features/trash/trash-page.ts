import {
  ChangeDetectionStrategy, Component, effect, inject, input, signal,
} from '@angular/core';
import type { DeletedEntry, Expense, Payment } from '@kitty/shared-types';
import { formatMoney } from '@kitty/shared-money';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { GroupStore } from '../../core/store/group.store';
import { ToastService } from '../../core/toast.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { UiButton } from '../../ui/ui-button/ui-button';
import { UiCard } from '../../ui/ui-card/ui-card';
import { UiEmptyState } from '../../ui/ui-empty-state/ui-empty-state';
import { UiPageHeader } from '../../ui/ui-page-header/ui-page-header';

/**
 * @description Lists soft-deleted expenses and payments so they can be restored. An accidental
 * delete changes every balance in the group, so deletion is reversible.
 */
@Component({
  selector: 'app-trash-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiPageHeader, UiCard, UiButton, UiEmptyState],
  template: `
    <main class="flex min-h-dvh flex-col gap-4 px-4 py-4 md:mx-auto md:max-w-2xl">
      <ui-page-header [backLink]="['/g', gid(), 'settings']" [title]="i18n.t('trash.title')" />

      @if (loading()) {
        <div class="space-y-2">
          @for (i of [1, 2, 3]; track i) {
            <div class="h-16 animate-pulse rounded-2xl bg-slate-100"></div>
          }
        </div>
      } @else if (entries().length === 0) {
        <ui-empty-state
          icon="🗑️"
          [title]="i18n.t('trash.empty')"
          [message]="i18n.t('trash.emptyHint')"
        />
      } @else {
        <ui-card [padded]="false">
          <ul class="divide-y divide-slate-100">
            @for (row of entries(); track row.kind + row.id) {
              <li class="flex items-center gap-3 px-4 py-3">
                <span class="shrink-0 text-lg" aria-hidden="true">
                  {{ row.kind === 'expense' ? '🧾' : '💸' }}
                </span>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium">{{ row.title }}</p>
                  <p class="text-xs text-slate-400">
                    {{ money(row) }} ·
                    {{ i18n.t('trash.deletedAt', { when: when(row.deletedAt) }) }}
                  </p>
                </div>
                <ui-button
                  variant="secondary"
                  size="sm"
                  [loading]="busyId() === row.kind + row.id"
                  [disabled]="busyId() !== null"
                  (click)="restore(row)"
                >
                  {{ i18n.t('trash.restore') }}
                </ui-button>
              </li>
            }
          </ul>
        </ui-card>
      }
    </main>
  `,
})
export class TrashPage {
  readonly gid = input.required<string>();

  protected readonly i18n = inject(I18nService);
  private readonly api = inject(ApiService);
  private readonly store = inject(GroupStore);
  private readonly toast = inject(ToastService);

  protected readonly entries = signal<DeletedEntry[]>([]);
  protected readonly loading = signal(true);
  /** `kind + id` of the row being restored, or null when idle. */
  protected readonly busyId = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.gid();
      void this.store.ensureLoaded(id);
      void this.load(id);
    });
  }

  private async load(groupId: string): Promise<void> {
    this.loading.set(true);
    try {
      // Independent endpoints: fetch in parallel.
      const [expenses, payments] = await Promise.all([
        firstValueFrom(this.api.listDeletedExpenses(groupId)),
        firstValueFrom(this.api.listDeletedPayments(groupId)),
      ]);
      this.entries.set(
        [...expenses, ...payments].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt)),
      );
    } catch {
      this.entries.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  protected async restore(row: DeletedEntry): Promise<void> {
    const key = row.kind + row.id;
    if (this.busyId()) return;
    this.busyId.set(key);
    try {
      // The ternary yields Observable<Expense> | Observable<Payment>; the explicit type
      // argument lets firstValueFrom accept that union.
      const request$ =
        row.kind === 'expense'
          ? this.api.restoreExpense(this.gid(), row.id)
          : this.api.restorePayment(this.gid(), row.id);
      await firstValueFrom<Expense | Payment>(request$);
      // Drop the row immediately so it can't be clicked again while the group reloads.
      this.entries.update((all) => all.filter((e) => e.kind + e.id !== key));
      this.toast.success(this.i18n.t('trash.restored'));
      // Force a reload so balances include the restored item; ensureLoaded() would skip it.
      await this.store.load(this.gid());
    } catch {
      this.toast.error(this.i18n.t('trash.restoreFailed'));
    } finally {
      this.busyId.set(null);
    }
  }

  protected money(row: DeletedEntry): string {
    return formatMoney(row.amountMinor, row.currency);
  }

  protected when(iso: string): string {
    const d = new Date(iso);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  }
}
