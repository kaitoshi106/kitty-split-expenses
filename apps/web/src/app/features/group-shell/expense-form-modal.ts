import {
  ChangeDetectionStrategy, Component, ElementRef, computed, inject, model, signal,
  viewChild,
} from '@angular/core';
import type { CreateExpenseDto, Expense, SplitType } from '@kitty/shared-types';
import { firstValueFrom } from 'rxjs';
import { computeShares, formatMoney } from '@kitty/shared-money';
import { ApiService } from '../../core/api/api.service';
import { ReceiptViewerService } from '../../core/receipt-viewer.service';
import { ToastService } from '../../core/toast.service';
import { GroupStore } from '../../core/store/group.store';
import { UiAvatar } from '../../ui/ui-avatar/ui-avatar';
import { UiButton } from '../../ui/ui-button/ui-button';
import { UiCurrencyInput } from '../../ui/ui-currency-input/ui-currency-input';
import { UiModal } from '../../ui/ui-modal/ui-modal';
import { UiReceiptPicker } from '../../ui/ui-receipt-picker/ui-receipt-picker';
import { UiNumeric } from '../../ui/numeric-input/numeric-input.directive';
import { UiSegmentedTabs } from '../../ui/ui-segmented-tabs/ui-segmented-tabs';
import { I18nService } from '../../core/i18n/i18n.service';
import { randomUuid } from '../../core/uuid';

/**
 * @description Create/edit expense modal.
 * - `idempotencyKey` is generated when the modal opens, not on submit, so a double-click on
 *   save creates a single expense.
 * - The share preview uses `computeShares` from shared-money, the same function the backend
 *   uses, so the displayed shares are exactly what gets stored.
 * - Save stays disabled unless SUM(payers) === amount and SUM(shares) === amount.
 * - Mismatch hints state the exact remaining or excess amount.
 */
@Component({
  selector: 'app-expense-form-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiModal, UiButton, UiAvatar, UiCurrencyInput, UiSegmentedTabs, UiNumeric, UiReceiptPicker],
  template: `
    <ui-modal [(open)]="open" [title]="i18n.t(editing() ? 'expenseForm.titleEdit' : 'expenseForm.titleNew')" (closed)="reset()">
      <div class="flex flex-col gap-5">
        <!-- Title -->
        <label class="flex flex-col gap-1">
          <span class="text-xs font-semibold uppercase tracking-wide text-slate-400">{{ i18n.t('expenseForm.name') }}</span>
          <!-- Autofocus here; showModal() would otherwise focus the close button first. -->
          <input
            data-autofocus
            class="min-h-11 rounded-xl border border-slate-200 px-3 text-sm
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            [placeholder]="i18n.t('expenseForm.namePlaceholder')"
            maxlength="120"
            [value]="title()"
            (input)="title.set($any($event.target).value)"
          />
        </label>

        <!-- Date -->
        <label class="flex flex-col gap-1">
          <span class="text-xs font-semibold uppercase tracking-wide text-slate-400">{{ i18n.t('common.date') }}</span>
          <input
            type="date"
            class="min-h-11 rounded-xl border border-slate-200 px-3 text-sm"
            [value]="date()"
            (input)="date.set($any($event.target).value)"
          />
        </label>

        <!-- Receipt attachment -->
        <div class="flex flex-col gap-1">
          <span class="text-xs font-semibold uppercase tracking-wide text-slate-400">{{
            i18n.t('receipt.section')
          }}</span>
          <ui-receipt-picker
            [(file)]="receiptFile"
            [existing]="existingReceipt()"
            (removed)="onReceiptRemoved()"
            (viewRequested)="viewReceipt()"
          />
          @if (!receiptFile() && !existingReceipt()) {
            <p class="text-xs text-slate-400">{{ i18n.t('receipt.hint') }}</p>
          }
        </div>

        <!-- Category -->
        <div class="flex flex-col gap-1">
          <span class="text-xs font-semibold uppercase tracking-wide text-slate-400">{{
            i18n.t('common.category')
          }}</span>

          <div class="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            @for (c of store.categories(); track c.id) {
              <button
                type="button"
                class="min-h-9 shrink-0 rounded-full border px-3 text-xs font-medium transition"
                [class]="
                  categoryId() === c.id
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-slate-200 text-slate-600'
                "
                (click)="categoryId.set(categoryId() === c.id ? null : c.id)"
              >
                {{ c.name }}
              </button>
            }

            <!-- Inline category creation, so a missing category doesn't force leaving a half-filled form. -->
            @if (!creatingCategory()) {
              <button
                type="button"
                class="min-h-9 shrink-0 rounded-full border border-dashed border-slate-300
                       px-3 text-xs font-medium text-slate-500 transition hover:bg-slate-50"
                (click)="startCreateCategory()"
              >
                {{ i18n.t('expenseForm.newCategory') }}
              </button>
            }
          </div>

          @if (creatingCategory()) {
            <div class="flex gap-2 pt-1">
              <input
                #newCategoryInput
                class="min-h-10 flex-1 rounded-xl border border-slate-200 px-3 text-sm
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                maxlength="40"
                [placeholder]="i18n.t('expenseForm.newCategoryPlaceholder')"
                [value]="newCategoryName()"
                (input)="newCategoryName.set($any($event.target).value)"
                (keydown.enter)="confirmCreateCategory()"
                (keydown.escape)="cancelCreateCategory()"
              />
              <ui-button
                size="sm"
                [disabled]="!newCategoryName().trim()"
                [loading]="savingCategory()"
                (click)="confirmCreateCategory()"
              >
                {{ i18n.t('common.add') }}
              </ui-button>
              <ui-button variant="ghost" size="sm" (click)="cancelCreateCategory()">
                {{ i18n.t('common.cancel') }}
              </ui-button>
            </div>
          }
        </div>

        <!-- Amount -->
        <div class="flex flex-col gap-1">
          <span class="text-xs font-semibold uppercase tracking-wide text-slate-400">{{ i18n.t('common.amount') }}</span>
          <ui-currency-input [(minor)]="amountMinor" [currency]="store.currency()" />
        </div>

        <!-- Paid by -->
        <section class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wide text-slate-400">{{ i18n.t('expenseForm.paidBy') }}</span>
            <button
              type="button"
              class="text-xs font-medium text-brand-600"
              (click)="multiPayer.set(!multiPayer())"
            >
              {{ i18n.t(multiPayer() ? 'expenseForm.onePerson' : 'expenseForm.manyPeople') }}
            </button>
          </div>

          @if (!multiPayer()) {
            <div class="flex flex-wrap gap-2">
              @for (m of store.members(); track m.id) {
                <button
                  type="button"
                  class="flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm transition"
                  [class]="
                    singlePayerId() === m.id
                      ? 'border-brand-500 bg-brand-50'
                      : 'border-slate-200'
                  "
                  (click)="singlePayerId.set(m.id)"
                >
                  <ui-avatar [name]="m.name" [color]="m.avatarColor" size="sm" />
                  {{ m.name }}
                </button>
              }
            </div>
          } @else {
            <div class="flex flex-col gap-2">
              @for (m of store.members(); track m.id) {
                <div class="flex items-center gap-2">
                  <ui-avatar [name]="m.name" [color]="m.avatarColor" size="sm" />
                  <span class="flex-1 truncate text-sm">{{ m.name }}</span>
                  <!-- uiNumeric = 0: integers only (minor units) -->
                  <input
                    [uiNumeric]="0"
                    class="min-h-10 w-32 rounded-lg border border-slate-200 px-2 text-right
                           text-sm tabular-nums"
                    [value]="payerAmounts()[m.id] || ''"
                    placeholder="0"
                    [attr.aria-label]="i18n.t('expenseForm.paidBy') + ' ' + m.name"
                    (uiNumericChange)="setPayerAmount(m.id, $event)"
                  />
                </div>
              }
              <p class="text-right text-xs" [class]="payersOk() ? 'text-credit' : 'text-debit'">
                {{ payerHint() }}
              </p>
            </div>
          }
        </section>

        <!-- Split between -->
        <section class="flex flex-col gap-3">
          <span class="text-xs font-semibold uppercase tracking-wide text-slate-400">{{ i18n.t('expenseForm.splitFor') }}</span>

          <ui-segmented-tabs
            [tabs]="splitTabs()"
            [active]="splitTypeTab()"
            (activeChange)="onSplitTabChange($event)"
          />

          <!-- The split section is disabled, with a hint, until an amount is entered. -->
          @if (!hasAmount()) {
            <p class="rounded-xl bg-slate-50 px-3 py-2 text-center text-xs text-slate-500">
              {{ i18n.t('expenseForm.amountFirst') }}
            </p>
          }

          <div class="flex flex-col gap-1" [class.opacity-50]="!hasAmount()">
            @for (m of store.members(); track m.id) {
              <div class="flex items-center gap-2 rounded-xl px-1 py-1">
                <input
                  type="checkbox"
                  class="h-5 w-5 shrink-0 rounded border-slate-300
                         disabled:cursor-not-allowed"
                  [checked]="isIncluded(m.id)"
                  [disabled]="!hasAmount()"
                  [attr.aria-label]="i18n.t('expenseForm.splitFor_a11y', { name: m.name })"
                  (change)="toggleMember(m.id)"
                />
                <ui-avatar [name]="m.name" [color]="m.avatarColor" size="sm" />
                <span class="flex-1 truncate text-sm">{{ m.name }}</span>

                @if (splitType() !== 'equal' && isIncluded(m.id)) {
                  @switch (splitType()) {
                    @case ('exact') {
                      <!-- Exact shares are money, so reuse the currency input for consistent formatting. -->
                      <ui-currency-input
                        size="sm"
                        [currency]="store.currency()"
                        [minor]="shareValues()[m.id] ?? 0"
                        [disabled]="!hasAmount()"
                        [ariaLabel]="i18n.t('expenseForm.splitFor_a11y', { name: m.name })"
                        (minorChange)="setShareValue(m.id, $event)"
                      />
                    }
                    @case ('percent') {
                      <!-- Capped at 100% -->
                      <div class="relative">
                        <input
                          [uiNumeric]="2"
                          [uiNumericMax]="100"
                          class="min-h-10 w-24 rounded-lg border border-slate-200 py-2 pl-2 pr-7
                                 text-right text-sm tabular-nums
                                 disabled:cursor-not-allowed disabled:bg-slate-50"
                          [value]="shareValues()[m.id] ?? ''"
                          [disabled]="!hasAmount()"
                          placeholder="0"
                          [attr.aria-label]="i18n.t('expenseForm.splitFor_a11y', { name: m.name })"
                          (uiNumericChange)="setShareValueRaw(m.id, $event)"
                        />
                        <span
                          class="pointer-events-none absolute inset-y-0 right-2 grid
                                 place-items-center text-xs text-slate-400"
                        >
                          {{ i18n.t('expenseForm.percentUnit') }}
                        </span>
                      </div>
                    }
                    @default {
                      <!-- Weight: number of parts, capped at 999 -->
                      <input
                        [uiNumeric]="2"
                        [uiNumericMax]="999"
                        class="min-h-10 w-24 rounded-lg border border-slate-200 px-2 text-right
                               text-sm tabular-nums
                               disabled:cursor-not-allowed disabled:bg-slate-50"
                        [value]="shareValues()[m.id] ?? ''"
                        [disabled]="!hasAmount()"
                        placeholder="1"
                        [attr.aria-label]="i18n.t('expenseForm.splitFor_a11y', { name: m.name })"
                        (uiNumericChange)="setShareValueRaw(m.id, $event)"
                      />
                    }
                  }
                }

                @if (isIncluded(m.id)) {
                  <span class="w-24 shrink-0 text-right text-sm tabular-nums text-slate-500">
                    {{ previewFor(m.id) }}
                  </span>
                }
              </div>
            }
          </div>

          <p class="text-right text-xs" [class]="sharesOk() ? 'text-credit' : 'text-debit'">
            {{ shareHint() }}
          </p>
        </section>

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
export class ExpenseFormModal {
  protected readonly i18n = inject(I18nService);

  readonly open = model(false);

  protected readonly store = inject(GroupStore);
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly receiptViewer = inject(ReceiptViewerService);

  /**
   * @description Clears per-member values when the user switches split type, since "50" means
   * 50% on one tab and 50 minor units on another. This is a click handler rather than an
   * effect on splitTypeTab: openEdit() sets the tab and then restores shareValues, and a
   * deferred effect would wipe the restored values.
   * @param tab - Selected split type id.
   */
  protected onSplitTabChange(tab: string): void {
    if (tab === this.splitTypeTab()) return;
    this.splitTypeTab.set(tab);
    this.shareValues.set({});
  }

  protected readonly splitTabs = computed(() => [
    { id: 'equal', label: this.i18n.t('expenseForm.splitEqual') },
    { id: 'exact', label: this.i18n.t('expenseForm.splitExact') },
    { id: 'percent', label: this.i18n.t('expenseForm.splitPercent') },
    { id: 'weight', label: this.i18n.t('expenseForm.splitWeight') },
  ]);

  protected readonly editing = signal<Expense | null>(null);
  protected readonly title = signal('');
  protected readonly categoryId = signal<string | null>(null);
  protected readonly amountMinor = signal(0);
  protected readonly date = signal(today());
  protected readonly multiPayer = signal(false);
  protected readonly singlePayerId = signal<string | null>(null);
  protected readonly payerAmounts = signal<Record<string, number>>({});
  protected readonly splitTypeTab = signal('equal');
  protected readonly includedIds = signal<string[]>([]);
  protected readonly shareValues = signal<Record<string, number | undefined>>({});
  protected readonly saving = signal(false);

  // Receipt
  protected readonly receiptFile = signal<File | null>(null);
  protected readonly existingReceipt = signal<Blob | null>(null);
  private existingReceiptId: string | null = null;
  private receiptCleared = false;

  // Inline category creation
  protected readonly creatingCategory = signal(false);
  protected readonly newCategoryName = signal('');
  protected readonly savingCategory = signal(false);
  private readonly newCategoryInput =
    viewChild<ElementRef<HTMLInputElement>>('newCategoryInput');

  /** Generated once per modal session (regenerated in reset()), not per submit, so retries are idempotent. */
  private idempotencyKey = randomUuid();

  protected readonly splitType = computed(() => this.splitTypeTab() as SplitType);

  /** The split section is disabled until an amount is entered. */
  protected readonly hasAmount = computed(() => this.amountMinor() > 0);

  // Payers
  private readonly payers = computed(() => {
    if (!this.multiPayer()) {
      const id = this.singlePayerId();
      return id ? [{ memberId: id, amountMinor: this.amountMinor() }] : [];
    }
    return Object.entries(this.payerAmounts())
      .filter(([, amount]) => amount > 0)
      .map(([memberId, amountMinor]) => ({ memberId, amountMinor }));
  });

  private readonly payersTotal = computed(() =>
    this.payers().reduce((s, p) => s + p.amountMinor, 0),
  );

  protected readonly payersOk = computed(
    () => this.amountMinor() > 0 && this.payersTotal() === this.amountMinor(),
  );

  protected readonly payerHint = computed(() => {
    const diff = this.amountMinor() - this.payersTotal();
    if (diff === 0) return this.i18n.t('expenseForm.matched');
    const currency = this.store.currency();
    return diff > 0
      ? this.i18n.t('expenseForm.missing', { amount: formatMoney(diff, currency) })
      : this.i18n.t('expenseForm.excess', { amount: formatMoney(-diff, currency) });
  });

  // Shares: preview with the same computeShares the backend uses
  private readonly computed_ = computed(() => {
    const amount = this.amountMinor();
    const ids = this.includedIds();
    if (amount <= 0 || ids.length === 0) return null;

    const inputs = ids.map((memberId) =>
      this.splitType() === 'equal'
        ? { memberId }
        : { memberId, value: this.shareValues()[memberId] ?? 0 },
    );
    try {
      return computeShares(amount, this.splitType(), inputs);
    } catch {
      return null; // invalid input; shareHint explains why
    }
  });

  protected readonly sharesOk = computed(() => this.computed_() !== null);

  protected readonly shareHint = computed(() => {
    const shares = this.computed_();
    if (shares) {
      return this.i18n.t('expenseForm.splitOk', {
        amount: formatMoney(this.amountMinor(), this.store.currency()),
      });
    }
    if (this.amountMinor() <= 0) return this.i18n.t('expenseForm.enterAmountFirst');
    if (this.includedIds().length === 0) return this.i18n.t('expenseForm.pickAtLeastOne');

    const type = this.splitType();
    const total = this.includedIds().reduce(
      (s, id) => s + (this.shareValues()[id] ?? 0), 0,
    );
    if (type === 'percent') return this.i18n.t('expenseForm.percentTotal', { total });
    if (type === 'exact') {
      const diff = this.amountMinor() - total;
      return diff > 0
        ? this.i18n.t('expenseForm.missing', {
            amount: formatMoney(diff, this.store.currency()),
          })
        : this.i18n.t('expenseForm.excess', {
            amount: formatMoney(-diff, this.store.currency()),
          });
    }
    return this.i18n.t('expenseForm.weightPositive');
  });

  protected readonly canSave = computed(
    () => this.title().trim().length > 0 && this.payersOk() && this.sharesOk(),
  );

  protected previewFor(memberId: string): string {
    const share = this.computed_()?.find((s) => s.memberId === memberId);
    return share ? formatMoney(share.amountMinor, this.store.currency()) : '—';
  }

  // Actions
  protected isIncluded(id: string): boolean {
    return this.includedIds().includes(id);
  }

  protected toggleMember(id: string): void {
    this.includedIds.update((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  }

  // Input is already sanitized by the uiNumeric directive.
  protected setPayerAmount(memberId: string, text: string): void {
    const value = Number(text.replace(/[.,]/g, '')) || 0;
    this.payerAmounts.update((map) => ({ ...map, [memberId]: value }));
  }

  /** Exact split: ui-currency-input already emits minor units. */
  protected setShareValue(memberId: string, minor: number): void {
    this.shareValues.update((map) => ({ ...map, [memberId]: minor }));
  }

  /** Percent and weight splits: the directive emits a sanitized numeric string. */
  protected setShareValueRaw(memberId: string, text: string): void {
    const value = Number(text) || 0;
    this.shareValues.update((map) => ({ ...map, [memberId]: value }));
  }

  /**
   * @description Opens the modal for a new expense, defaulting to an equal split across all
   * members paid by the current member.
   */
  openNew(): void {
    this.reset();
    this.includedIds.set(this.store.members().map((m) => m.id)); // split between everyone
    this.singlePayerId.set(this.store.currentMemberId() ?? this.store.members()[0]?.id ?? null);
    this.open.set(true);
  }

  /**
   * @description Opens the modal populated from an existing expense, including its receipt.
   * @param expense - Expense to edit.
   */
  openEdit(expense: Expense): void {
    this.reset();
    this.editing.set(expense);
    this.title.set(expense.title);
    this.categoryId.set(expense.categoryId);
    this.amountMinor.set(expense.amountMinor);
    this.date.set(expense.expenseDate);
    this.splitTypeTab.set(expense.splitType);
    this.includedIds.set(expense.shares.map((s) => s.memberId));
    this.shareValues.set(
      Object.fromEntries(expense.shares.map((s) => [s.memberId, s.shareValue ?? 0])),
    );
    if (expense.payers.length === 1) {
      this.singlePayerId.set(expense.payers[0].memberId);
    } else {
      this.multiPayer.set(true);
      this.payerAmounts.set(
        Object.fromEntries(expense.payers.map((p) => [p.memberId, p.amountMinor])),
      );
    }
    this.open.set(true);
    void this.loadExistingReceipt(expense.receiptId);
  }

  /**
   * @description Loads the stored receipt when editing. Also records `existingReceiptId`, which
   * save() needs so editing an expense doesn't overwrite its receiptId with null.
   * @param receiptId - Receipt attached to the expense, if any.
   */
  private async loadExistingReceipt(receiptId: string | null): Promise<void> {
    this.existingReceiptId = receiptId;
    if (!receiptId) return;

    const gid = this.store.groupId();
    if (!gid) return;
    try {
      this.existingReceipt.set(await firstValueFrom(this.api.downloadReceipt(gid, receiptId)));
    } catch {
      // Receipt no longer exists on the server: drop the dangling id.
      this.existingReceiptId = null;
    }
  }

  protected startCreateCategory(): void {
    this.creatingCategory.set(true);
    this.newCategoryName.set('');
    // The input only exists after the @if block renders, so focus on the next tick.
    setTimeout(() => this.newCategoryInput()?.nativeElement.focus(), 0);
  }

  protected cancelCreateCategory(): void {
    this.creatingCategory.set(false);
    this.newCategoryName.set('');
  }

  /** Creates the category and selects it for the current expense. */
  protected async confirmCreateCategory(): Promise<void> {
    const name = this.newCategoryName().trim();
    if (!name || this.savingCategory()) return;

    this.savingCategory.set(true);
    try {
      const before = new Set(this.store.categories().map((c) => c.id));
      await this.store.addCategory(name, 'tag');
      const created = this.store.categories().find((c) => !before.has(c.id));
      if (created) {
        this.categoryId.set(created.id);
        this.cancelCreateCategory();
    this.receiptFile.set(null);
    this.existingReceipt.set(null);
    this.existingReceiptId = null;
    this.receiptCleared = false;
      }
    } finally {
      this.savingCategory.set(false);
    }
  }

  /** Opens the viewer for a stored receipt; a newly picked file has no id yet. */
  protected viewReceipt(): void {
    const gid = this.store.groupId();
    if (gid && this.existingReceiptId) {
      this.receiptViewer.show(gid, this.existingReceiptId);
    }
  }

  protected onReceiptRemoved(): void {
    this.existingReceipt.set(null);
    this.receiptCleared = true;
  }

  /**
   * @description Uploads a newly picked receipt before the expense is saved, since the expense
   * only stores `receiptId`. An upload failure is reported but does not block saving the expense.
   * @returns The receipt id to store, or null for none.
   */
  private async resolveReceiptId(): Promise<string | null> {
    const file = this.receiptFile();
    if (file) {
      const gid = this.store.groupId();
      if (!gid) return null;
      try {
        const uploaded = await firstValueFrom(this.api.uploadReceipt(gid, file));
        return uploaded.id;
      } catch {
        this.toast.error(this.i18n.t('receipt.uploadFailed'));
        return null;
      }
    }
    return this.receiptCleared ? null : this.existingReceiptId;
  }

  protected async save(): Promise<void> {
    // Guard again: save() can still be triggered by keyboard or other callers.
    if (!this.canSave()) return;

    // Set `saving` before any await so the button is locked during the receipt upload;
    // otherwise repeated clicks would each trigger a save.
    if (this.saving()) return;
    this.saving.set(true);

    // Snapshot the form before any await: if the dialog closes during the upload,
    // (closed)="reset()" clears every signal and an empty payload would be sent.
    const draft = {
      title: this.title().trim(),
      categoryId: this.categoryId(),
      amountMinor: this.amountMinor(),
      currency: this.store.currency(),
      expenseDate: this.date(),
      payers: this.payers(),
      splitType: this.splitType(),
      shares: this.includedIds().map((memberId) =>
        this.splitType() === 'equal'
          ? { memberId }
          : { memberId, value: this.shareValues()[memberId] ?? 0 },
      ),
    };
    const target = this.editing();
    const idempotencyKey = this.idempotencyKey;

    const receiptId = await this.resolveReceiptId();
    const dto: CreateExpenseDto = { ...draft, receiptId };

    try {
      const result = target
        ? await this.store.updateExpense(target.id, dto)
        : await this.store.addExpense(dto, idempotencyKey);
      if (result) this.open.set(false);
    } finally {
      this.saving.set(false);
    }
  }

  protected reset(): void {
    this.editing.set(null);
    this.title.set('');
    this.categoryId.set(null);
    this.amountMinor.set(0);
    this.date.set(today());
    this.multiPayer.set(false);
    this.singlePayerId.set(null);
    this.payerAmounts.set({});
    this.splitTypeTab.set('equal');
    this.includedIds.set([]);
    this.shareValues.set({});
    this.cancelCreateCategory();
    this.receiptFile.set(null);
    this.existingReceipt.set(null);
    this.existingReceiptId = null;
    this.receiptCleared = false;
    this.idempotencyKey = randomUuid(); // fresh key for the next session
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
