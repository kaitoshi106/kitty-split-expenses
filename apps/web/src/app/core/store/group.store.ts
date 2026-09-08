import { Injectable, computed, inject, signal } from '@angular/core';
import type {
  Balance, Category, CreateExpenseDto, CreatePaymentDto, Expense, Group, Member,
  Payment, Transfer, UpdateExpenseDto,
} from '@kitty/shared-types';
import {
  buildSummaryReport, calculateBalances, computeShares, directDebts, minimizeTransactions,
} from '@kitty/shared-money';
import { firstValueFrom } from 'rxjs';
import { I18nService } from '../i18n/i18n.service';
import { ApiService } from '../api/api.service';
import { SessionStore } from '../session.store';
import { ToastService } from '../toast.service';

/**
 * @description State of the currently open group. Balances, settle-up suggestions and the
 * summary report are `computed()` from expenses and payments, never stored, so any
 * mutation updates every view without an explicit refresh.
 */
@Injectable({ providedIn: 'root' })
export class GroupStore {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionStore);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  // ─── source state ───
  readonly groupId = signal<string | null>(null);
  readonly group = signal<Group | null>(null);
  readonly members = signal<Member[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly expenses = signal<Expense[]>([]);
  readonly payments = signal<Payment[]>([]);
  readonly currentMemberId = signal<string | null>(null);

  /** Role of this device's member; UI visibility only, enforced by the backend AdminGuard. */
  readonly currentRole = signal<'admin' | 'member'>('member');
  readonly loading = signal(false);
  readonly loaded = signal(false);

  // ─── derived state ───

  readonly currency = computed(() => this.group()?.baseCurrency ?? 'VND');

  /** Per-member balances derived from expenses and payments; they always sum to zero. */
  readonly balances = computed<Balance[]>(() =>
    calculateBalances(
      this.members().map((m) => ({ id: m.id })),
      this.expenses(),
      this.payments(),
    ),
  );

  /**
   * Suggested transfers, honoring the group's `simplifyDebts` flag with the same functions
   * the backend uses. `=== false` makes an unloaded group default to simplified, like the server.
   */
  readonly settleUp = computed<Transfer[]>(() =>
    this.group()?.simplifyDebts === false
      ? directDebts(this.expenses(), this.payments())
      : minimizeTransactions(this.balances()),
  );

  readonly totalSpentMinor = computed(() =>
    this.expenses().reduce((sum, e) => sum + e.amountBaseMinor, 0),
  );

  readonly myBalance = computed(() => {
    const id = this.currentMemberId();
    return id ? (this.balances().find((b) => b.memberId === id)?.balanceMinor ?? 0) : 0;
  });

  /**
   * Members paired with their balance, largest debtor last. Shared by the overview and
   * balances screens so both use the same order.
   */
  readonly balanceRows = computed(() => {
    const byId = new Map(this.balances().map((b) => [b.memberId, b.balanceMinor]));
    return this.members()
      .map((member) => ({ member, balanceMinor: byId.get(member.id) ?? 0 }))
      .sort((a, b) => b.balanceMinor - a.balanceMinor);
  });

  readonly memberById = computed(() => new Map(this.members().map((m) => [m.id, m])));
  readonly categoryById = computed(() => new Map(this.categories().map((c) => [c.id, c])));

  /**
   * Summary report built with the same function the backend uses for PDF/XLSX export,
   * shared by the overview and summary screens so their figures always agree.
   * `generatedAt` is unused on the client; the export date is set server-side.
   */
  readonly report = computed(() =>
    buildSummaryReport({
      groupName: this.group()?.name ?? '',
      currency: this.currency(),
      generatedAt: new Date(),
      members: this.members(),
      expenses: this.expenses(),
      payments: this.payments(),
      categoryName: (id) =>
        id === null
          ? this.i18n.t('summary.uncategorized')
          : (this.categoryById().get(id)?.name ?? this.i18n.t('summary.deletedCategory')),
      paymentLabel: this.i18n.t('expenses.paymentRow'),
      simplifyDebts: this.group()?.simplifyDebts !== false,
    }),
  );

  readonly isSettled = computed(() => this.balances().every((b) => b.balanceMinor === 0));

  /** Whether the current member is an admin (the group creator starts as admin). */
  readonly isAdmin = computed(() => this.currentRole() === 'admin');

  readonly currentMember = computed(() => {
    const id = this.currentMemberId();
    return id ? (this.memberById().get(id) ?? null) : null;
  });

  // ─── loading ───

  /** @description Loads the group unless it is already loaded. */
  async ensureLoaded(groupId: string): Promise<void> {
    if (this.groupId() === groupId && this.loaded()) return;
    await this.load(groupId);
  }

  /** @description Fetches group, members, categories, expenses and payments in parallel. */
  async load(groupId: string): Promise<void> {
    this.loading.set(true);
    this.groupId.set(groupId);

    // Restore identity from the token before fetching so the UI knows the user immediately after a reload.
    const identity = this.session.getIdentity(groupId);
    if (identity) {
      this.currentMemberId.set(identity.memberId);
      this.currentRole.set(identity.role);
    }

    try {
      const [group, members, categories, expenses, payments] = await Promise.all([
        firstValueFrom(this.api.getGroup(groupId)),
        firstValueFrom(this.api.listMembers(groupId)),
        firstValueFrom(this.api.listCategories(groupId)),
        firstValueFrom(this.api.listExpenses(groupId)),
        firstValueFrom(this.api.listPayments(groupId)),
      ]);
      this.group.set(group);
      this.members.set(members);
      this.categories.set(categories);
      this.expenses.set(expenses);
      this.payments.set(payments);
      this.loaded.set(true);
      this.session.rememberGroup(group.id, group.name, group.createdAt);
    } finally {
      this.loading.set(false);
    }
  }

  setCurrentMember(memberId: string, role: 'admin' | 'member' = 'member'): void {
    this.currentMemberId.set(memberId);
    this.currentRole.set(role);
  }

  reset(): void {
    this.groupId.set(null);
    this.group.set(null);
    this.members.set([]);
    this.categories.set([]);
    this.expenses.set([]);
    this.payments.set([]);
    this.currentMemberId.set(null);
    this.currentRole.set('member');
    this.loaded.set(false);
  }

  // ─── expense ───

  /**
   * @description Creates an expense optimistically: a temporary record is shown immediately,
   * then replaced by the saved one or rolled back on failure.
   * @param dto - Expense payload.
   * @param idempotencyKey - Generated when the form opens, so repeated submits create one expense.
   * @returns The saved expense, or null on failure (the interceptor shows the error).
   */
  async addExpense(dto: CreateExpenseDto, idempotencyKey: string): Promise<Expense | null> {
    const gid = this.requireGroupId();
    const temp = this.buildTempExpense(gid, dto, idempotencyKey);
    this.expenses.update((list) => [temp, ...list]);

    try {
      const saved = await firstValueFrom(this.api.createExpense(gid, dto, idempotencyKey));
      this.expenses.update((list) => list.map((e) => (e.id === temp.id ? saved : e)));
      return saved;
    } catch {
      this.expenses.update((list) => list.filter((e) => e.id !== temp.id)); // rollback
      return null;
    }
  }

  /** @description Updates an expense; returns null on failure. */
  async updateExpense(id: string, dto: UpdateExpenseDto): Promise<Expense | null> {
    const gid = this.requireGroupId();
    const before = this.expenses();
    try {
      const saved = await firstValueFrom(this.api.updateExpense(gid, id, dto));
      this.expenses.update((list) => list.map((e) => (e.id === id ? saved : e)));
      return saved;
    } catch {
      this.expenses.set(before);
      return null;
    }
  }

  /** @description Soft-deletes an expense optimistically and offers an undo toast. */
  async removeExpense(id: string): Promise<void> {
    const gid = this.requireGroupId();
    const before = this.expenses();
    const removed = before.find((e) => e.id === id);
    this.expenses.update((list) => list.filter((e) => e.id !== id));

    try {
      await firstValueFrom(this.api.deleteExpense(gid, id));
      this.toast.undo(
        this.i18n.t('toast.deleted', { title: removed?.title ?? '' }),
        this.i18n.t('toast.undo'),
        () => {
          void this.restoreExpense(id);
        },
      );
    } catch {
      this.expenses.set(before);
    }
  }

  /** @description Restores a soft-deleted expense and reinserts it in date order. */
  async restoreExpense(id: string): Promise<void> {
    const gid = this.requireGroupId();
    try {
      const restored = await firstValueFrom(this.api.restoreExpense(gid, id));
      this.expenses.update((list) =>
        [restored, ...list.filter((e) => e.id !== id)].sort(byDateDesc),
      );
      this.toast.success(this.i18n.t('toast.undone'));
    } catch {
      /* Error already shown by the interceptor. */
    }
  }

  // ─── payment ───

  async addPayment(dto: CreatePaymentDto): Promise<Payment | null> {
    const gid = this.requireGroupId();
    try {
      const saved = await firstValueFrom(this.api.createPayment(gid, dto));
      this.payments.update((list) => [saved, ...list]);
      return saved;
    } catch {
      return null;
    }
  }

  /** @description Soft-deletes a payment optimistically and offers an undo toast. */
  async removePayment(id: string): Promise<void> {
    const gid = this.requireGroupId();
    const before = this.payments();
    const removed = before.find((p) => p.id === id);
    this.payments.update((list) => list.filter((p) => p.id !== id));

    try {
      await firstValueFrom(this.api.deletePayment(gid, id));
      // Payments have no title; label them as "from → to".
      const label = removed
        ? `${this.memberById().get(removed.fromMemberId)?.name ?? '?'} → ` +
          `${this.memberById().get(removed.toMemberId)?.name ?? '?'}`
        : '';
      this.toast.undo(
        this.i18n.t('toast.deleted', { title: label }),
        this.i18n.t('toast.undo'),
        () => {
          void this.restorePayment(id);
        },
      );
    } catch {
      this.payments.set(before);
    }
  }

  async restorePayment(id: string): Promise<void> {
    const gid = this.requireGroupId();
    try {
      const restored = await firstValueFrom(this.api.restorePayment(gid, id));
      this.payments.update((list) => [restored, ...list.filter((p) => p.id !== id)]);
      this.toast.success(this.i18n.t('toast.undone'));
    } catch {
      /* Error already shown by the interceptor. */
    }
  }

  // ─── member ───

  async addMember(name: string): Promise<Member | null> {
    const gid = this.requireGroupId();
    try {
      const saved = await firstValueFrom(this.api.createMember(gid, { name }));
      this.members.update((list) => [...list, saved]);
      return saved;
    } catch {
      return null;
    }
  }

  async renameMember(memberId: string, name: string): Promise<void> {
    const gid = this.requireGroupId();
    try {
      const saved = await firstValueFrom(this.api.updateMember(gid, memberId, { name }));
      this.members.update((list) => list.map((m) => (m.id === memberId ? saved : m)));
    } catch {
      /* Error already shown by the interceptor. */
    }
  }

  /**
   * @description Grants or revokes admin; updates `currentRole` when the target is the current member.
   * @returns Whether the change succeeded.
   */
  async setMemberRole(memberId: string, role: 'admin' | 'member'): Promise<boolean> {
    const gid = this.requireGroupId();
    try {
      const saved = await firstValueFrom(this.api.setMemberRole(gid, memberId, role));
      this.members.update((list) => list.map((m) => (m.id === memberId ? saved : m)));
      if (memberId === this.currentMemberId()) this.currentRole.set(saved.role);
      return true;
    } catch {
      return false; // e.g. 409 LAST_ADMIN; the interceptor already showed it
    }
  }

  async removeMember(memberId: string): Promise<boolean> {
    const gid = this.requireGroupId();
    try {
      await firstValueFrom(this.api.deleteMember(gid, memberId));
      this.members.update((list) => list.filter((m) => m.id !== memberId));
      return true;
    } catch {
      return false; // e.g. 409 MEMBER_HAS_BALANCE; the interceptor already showed it
    }
  }

  // ─── group ───

  async updateGroup(patch: { name?: string; baseCurrency?: string; simplifyDebts?: boolean }) {
    const gid = this.requireGroupId();
    try {
      const saved = await firstValueFrom(this.api.updateGroup(gid, patch));
      this.group.set(saved);
    } catch {
      /* Error already shown by the interceptor. */
    }
  }

  async addCategory(name: string, icon: string): Promise<void> {
    const gid = this.requireGroupId();
    try {
      const saved = await firstValueFrom(this.api.createCategory(gid, { name, icon }));
      this.categories.update((list) => [...list, saved]);
    } catch {
      /* noop */
    }
  }

  async removeCategory(id: string): Promise<void> {
    const gid = this.requireGroupId();
    const before = this.categories();
    this.categories.update((list) => list.filter((c) => c.id !== id));
    try {
      await firstValueFrom(this.api.deleteCategory(gid, id));
    } catch {
      this.categories.set(before);
    }
  }

  // ─── helper ───

  private requireGroupId(): string {
    const id = this.groupId();
    if (!id) throw new Error('GroupStore is not loaded; call ensureLoaded() first');
    return id;
  }

  /** @description Builds the temporary expense shown during an optimistic create. */
  private buildTempExpense(
    groupId: string,
    dto: CreateExpenseDto,
    idempotencyKey: string,
  ): Expense {
    return {
      id: `temp-${idempotencyKey}`,
      groupId,
      categoryId: dto.categoryId ?? null,
      title: dto.title,
      amountMinor: dto.amountMinor,
      currency: dto.currency,
      fxRate: 1,
      amountBaseMinor: dto.amountMinor,
      splitType: dto.splitType,
      expenseDate: dto.expenseDate,
      note: dto.note ?? null,
      createdByMemberId: this.currentMemberId() ?? '',
      createdAt: new Date().toISOString(),
      receiptId: dto.receiptId ?? null,
      payers: dto.payers.map((p) => ({ memberId: p.memberId, amountMinor: p.amountMinor })),
      shares: computeTempShares(dto),
    };
  }
}

/**
 * @description Computes shares with the same function as the backend so the optimistic
 * figures match what will be saved. Falls back to zero shares instead of throwing,
 * since a temporary record must never break the UI.
 */
function computeTempShares(dto: CreateExpenseDto) {
  try {
    return computeShares(dto.amountMinor, dto.splitType, dto.shares);
  } catch {
    return dto.shares.map((s) => ({ memberId: s.memberId, shareValue: null, amountMinor: 0 }));
  }
}

const byDateDesc = (a: Expense, b: Expense) =>
  b.expenseDate.localeCompare(a.expenseDate) || b.createdAt.localeCompare(a.createdAt);
