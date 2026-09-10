import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import type { Expense, Payment } from '@kitty/shared-types';
import { formatMoney } from '@kitty/shared-money';
import { ExpenseEditorService } from '../../core/expense-editor.service';
import { ReceiptViewerService } from '../../core/receipt-viewer.service';
import { GroupStore } from '../../core/store/group.store';
import { UiAmount } from '../../ui/ui-amount/ui-amount';
import { UiAvatar } from '../../ui/ui-avatar/ui-avatar';
import { UiCard } from '../../ui/ui-card/ui-card';
import { UiEmptyState } from '../../ui/ui-empty-state/ui-empty-state';
import { I18nService } from '../../core/i18n/i18n.service';

type Row =
  | { kind: 'expense'; date: string; data: Expense }
  | { kind: 'payment'; date: string; data: Payment };

interface MonthGroup {
  key: string;
  label: string;
  subtotalMinor: number;
  rows: Row[];
}

/**
 * @description Expense and payment timeline grouped by month, with search and category filters.
 * Built as a chain of computed() steps (filtered → merged → grouped) so only the affected
 * step recomputes.
 */
@Component({
  selector: 'app-expenses-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiCard, UiAvatar, UiAmount, UiEmptyState],
  template: `
    <div class="flex flex-col gap-4">
      <!-- Summary stats -->
      <div class="grid grid-cols-3 gap-2">
        <ui-card>
          <p class="text-[10px] uppercase text-slate-400">{{ i18n.t('expenses.total') }}</p>
          <ui-amount [minor]="store.totalSpentMinor()" [currency]="store.currency()" size="sm" />
        </ui-card>
        <ui-card>
          <p class="text-[10px] uppercase text-slate-400">{{ i18n.t('expenses.perMember') }}</p>
          <ui-amount [minor]="perMemberMinor()" [currency]="store.currency()" size="sm" />
        </ui-card>
        <ui-card>
          <p class="text-[10px] uppercase text-slate-400">{{ i18n.t('expenses.largest') }}</p>
          <ui-amount [minor]="largestMinor()" [currency]="store.currency()" size="sm" />
        </ui-card>
      </div>

      <!-- Search -->
      <input
        class="min-h-11 rounded-xl border border-slate-200 px-3 text-sm
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        [placeholder]="i18n.t('expenses.search')"
        [value]="query()"
        (input)="query.set($any($event.target).value)"
      />

      <!-- Category chips -->
      <div class="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <button
          type="button"
          class="min-h-9 shrink-0 rounded-full border px-3 text-xs font-medium"
          [class]="
            categoryFilter() === null
              ? 'border-brand-500 bg-brand-50 text-brand-700'
              : 'border-slate-200 text-slate-600'
          "
          (click)="categoryFilter.set(null)"
        >
          {{ i18n.t('expenses.all') }}
        </button>
        @for (c of store.categories(); track c.id) {
          <button
            type="button"
            class="min-h-9 shrink-0 rounded-full border px-3 text-xs font-medium"
            [class]="
              categoryFilter() === c.id
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-slate-200 text-slate-600'
            "
            (click)="categoryFilter.set(c.id)"
          >
            {{ c.name }}
          </button>
        }
      </div>

      @if (grouped().length === 0) {
        <ui-empty-state
          icon="🧾"
          [title]="i18n.t('expenses.empty')"
          [message]="i18n.t('expenses.emptyHint')"
        />
      } @else {
        @for (month of grouped(); track month.key) {
          <section>
            <!-- Sticky month header -->
            <div
              class="sticky top-0 z-10 -mx-4 flex items-center justify-between bg-surface/95 px-4
                     py-2 backdrop-blur"
            >
              <span class="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {{ month.label }}
              </span>
              <span class="text-xs font-medium tabular-nums text-slate-500">
                {{ money(month.subtotalMinor) }}
              </span>
            </div>

            <ui-card [padded]="false">
              <div class="divide-y divide-slate-100">
                @for (row of month.rows; track row.data.id) {
                  @if (row.kind === 'expense') {
                    <!--
                      Edit and delete are sibling buttons: nesting a button in a button is invalid HTML.
                      Delete needs a real <button> for keyboard and screen-reader support.
                    -->
                    <div class="flex min-h-16 items-center">
                      <!--
                        min-w-0 is required: flex items default to min-width:auto, so long amounts
                        would widen the button and push the delete button out of alignment.
                      -->
                      <button
                        type="button"
                        class="flex min-h-16 min-w-0 flex-1 items-center gap-3 py-2 pl-4 pr-2
                               text-left hover:bg-slate-50"
                        (click)="edit($any(row.data))"
                      >
                        <ui-avatar
                          [name]="payerName($any(row.data))"
                          [color]="payerColor($any(row.data))"
                          size="sm"
                        />
                        <div class="min-w-0 flex-1">
                          <div class="flex items-center gap-1.5">
                            <span class="truncate text-sm font-medium">{{ row.data.title }}</span>
                            @if ($any(row.data).receiptId) {
                              <!--
                                Opens the receipt without entering the edit modal. A span with
                                role="button" because it sits inside the row's edit button;
                                viewReceipt() stops propagation.
                              -->
                              <span
                                role="button"
                                tabindex="0"
                                class="shrink-0 rounded px-1 text-xs hover:bg-slate-200
                                       focus-visible:outline-none focus-visible:ring-2
                                       focus-visible:ring-brand-500"
                                [attr.aria-label]="i18n.t('receipt.view')"
                                (click)="viewReceipt($event, $any(row.data).receiptId)"
                                (keydown.enter)="viewReceipt($event, $any(row.data).receiptId)"
                                (keydown.space)="viewReceipt($event, $any(row.data).receiptId)"
                                >📎</span
                              >
                            }
                          </div>
                          <div class="truncate text-xs text-slate-500">
                            {{ payerLabel($any(row.data)) }} · {{ row.date }}
                          </div>
                        </div>
                        <div class="shrink-0 text-right">
                          <ui-amount
                            [minor]="$any(row.data).amountMinor"
                            [currency]="store.currency()"
                            size="sm"
                          />
                          <div class="text-[11px] tabular-nums text-slate-400">
                            {{ i18n.t('expenses.yourShare') }}
                            {{ myShareLabel($any(row.data)) }}
                          </div>
                        </div>
                      </button>
                      <button
                        type="button"
                        class="grid h-10 w-10 shrink-0 place-items-center rounded-lg
                               text-slate-300 hover:bg-slate-100 hover:text-debit
                               focus-visible:outline-none focus-visible:ring-2
                               focus-visible:ring-brand-500"
                        [attr.aria-label]="i18n.t('expenses.deleteRow', { title: row.data.title })"
                        (click)="removeRow(row)"
                      >
                        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                             aria-hidden="true">
                          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
                        </svg>
                      </button>
                    </div>
                  } @else {
                    <!-- Mirrors the expense row structure so amounts and delete buttons align. -->
                    <div class="flex min-h-16 items-center">
                      <div class="flex min-w-0 flex-1 items-center gap-3 py-2 pl-4 pr-2">
                        <span class="grid h-7 w-7 shrink-0 place-items-center rounded-full
                                     bg-slate-100 text-xs">💸</span>
                        <div class="min-w-0 flex-1">
                          <div class="truncate text-sm font-medium">
                            {{ name($any(row.data).fromMemberId) }} →
                            {{ name($any(row.data).toMemberId) }}
                          </div>
                          <div class="truncate text-xs text-slate-500">
                            {{ i18n.t('expenses.paymentRow') }} · {{ row.date }}
                          </div>
                        </div>
                        <div class="shrink-0 text-right">
                          <ui-amount
                            [minor]="$any(row.data).amountMinor"
                            [currency]="store.currency()"
                            size="sm"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        class="grid h-10 w-10 shrink-0 place-items-center rounded-lg
                               text-slate-300 hover:bg-slate-100 hover:text-debit
                               focus-visible:outline-none focus-visible:ring-2
                               focus-visible:ring-brand-500"
                        [attr.aria-label]="
                          i18n.t('expenses.deleteRow', { title: i18n.t('expenses.paymentRow') })
                        "
                        (click)="removeRow(row)"
                      >
                        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                             aria-hidden="true">
                          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
                        </svg>
                      </button>
                    </div>
                  }
                }
              </div>
            </ui-card>
          </section>
        }
      }
    </div>
  `,
})
export class ExpensesTab {
  protected readonly i18n = inject(I18nService);

  protected readonly store = inject(GroupStore);
  private readonly editor = inject(ExpenseEditorService);
  private readonly receiptViewer = inject(ReceiptViewerService);

  protected readonly query = signal('');
  protected readonly categoryFilter = signal<string | null>(null);

  // Step 1: filter expenses
  private readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const cat = this.categoryFilter();
    return this.store.expenses().filter((e) => {
      if (cat && e.categoryId !== cat) return false;
      if (q && !e.title.toLowerCase().includes(q)) return false;
      return true;
    });
  });

  // Step 2: merge expenses and payments into one timeline
  private readonly merged = computed<Row[]>(() => {
    const rows: Row[] = [
      ...this.filtered().map((e) => ({ kind: 'expense' as const, date: e.expenseDate, data: e })),
      // Payments have no title or category, so they are hidden while a filter is active.
      ...(this.query() || this.categoryFilter()
        ? []
        : this.store.payments().map((p) => ({
            kind: 'payment' as const, date: p.paymentDate, data: p,
          }))),
    ];
    return rows.sort((a, b) => b.date.localeCompare(a.date));
  });

  // Step 3: group by month
  protected readonly grouped = computed<MonthGroup[]>(() => {
    const map = new Map<string, MonthGroup>();
    for (const row of this.merged()) {
      const key = row.date.slice(0, 7); // YYYY-MM
      if (!map.has(key)) {
        const [year, month] = key.split('-');
        map.set(key, {
          key,
          label: this.i18n.t('expenses.month', { month: Number(month), year }),
          subtotalMinor: 0,
          rows: [],
        });
      }
      const group = map.get(key) as MonthGroup;
      group.rows.push(row);
      if (row.kind === 'expense') group.subtotalMinor += row.data.amountBaseMinor;
    }
    return [...map.values()].sort((a, b) => b.key.localeCompare(a.key));
  });

  protected readonly perMemberMinor = computed(() => {
    const count = this.store.members().length;
    return count > 0 ? Math.round(this.store.totalSpentMinor() / count) : 0;
  });

  protected readonly largestMinor = computed(() =>
    this.store.expenses().reduce((max, e) => Math.max(max, e.amountBaseMinor), 0),
  );

  protected money(minor: number): string {
    return formatMoney(minor, this.store.currency());
  }

  protected name(memberId: string): string {
    return this.store.memberById().get(memberId)?.name ?? '?';
  }

  protected payerName(e: Expense): string {
    return this.name(e.payers[0]?.memberId ?? '');
  }

  protected payerColor(e: Expense): string {
    return this.store.memberById().get(e.payers[0]?.memberId ?? '')?.avatarColor ?? '#CBD5E1';
  }

  protected payerLabel(e: Expense): string {
    const first = this.payerName(e);
    const extra = e.payers.length - 1;
    const who = extra > 0 ? `${first}+${extra}` : first;
    return this.i18n.t('expenses.paidBy', { who, n: e.shares.length });
  }

  /** Current member's net for this expense (paid − share), signed. */
  protected myShareLabel(e: Expense): string {
    const me = this.store.currentMemberId();
    if (!me) return '—';
    const paid = e.payers.find((p) => p.memberId === me)?.amountMinor ?? 0;
    const owed = e.shares.find((s) => s.memberId === me)?.amountMinor ?? 0;
    return formatMoney(paid - owed, this.store.currency(), { signed: true });
  }

  /**
   * @description Soft-deletes an expense or payment without a confirm dialog. Recovery is via the
   * undo toast or, later, the trash page.
   * @param row - Timeline row to remove.
   */
  protected removeRow(row: { kind: string; data: { id: string } }): void {
    if (row.kind === 'expense') void this.store.removeExpense(row.data.id);
    else void this.store.removePayment(row.data.id);
  }

  /** Opens the receipt image without entering the edit modal. */
  protected viewReceipt(event: Event, receiptId: string): void {
    event.stopPropagation();
    event.preventDefault();
    const gid = this.store.groupId();
    if (gid) this.receiptViewer.show(gid, receiptId);
  }

  /** Clicking a row opens it for editing via the shell's shared modal. */
  protected edit(e: Expense): void {
    this.editor.requestEdit(e);
  }
}
