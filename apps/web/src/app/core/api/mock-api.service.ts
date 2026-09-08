import type { HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import type {
  ActivityEntry, AuthResult, DeletedEntry, Balance, Category, ClaimMemberDto, CreateCategoryDto, CreateExpenseDto,
  CreateGroupDto, CreateMemberDto, CreatePaymentDto, Expense, Group, GroupSummary,
  LookupGroupResult, Member, MemberDetail, Payment, Receipt, UpdateCategoryDto,
  UpdateExpenseDto, UpdateGroupDto, UpdateMemberDto, UpdatePaymentDto,
} from '@kitty/shared-types';
import {
  calculateBalances, computeShares,
} from '@kitty/shared-money';
import { Observable, delay, of, throwError } from 'rxjs';
import { ApiService, type ExportFormat, type ListExpensesParams } from './api.service';
import { randomUuid } from '../uuid';

/** Artificial latency so loading states are exercised; instant responses would hide them. */
const LATENCY_MS = 250;

/**
 * @description In-memory ApiService for running the UI and component tests without a backend.
 * Uses the same shared-money functions as the API for splits and balances.
 */
@Injectable()
export class MockApiService extends ApiService {
  private groups = new Map<string, Group>();
  private members = new Map<string, Member[]>();
  private categories = new Map<string, Category[]>();
  private expenses = new Map<string, Expense[]>();
  private payments = new Map<string, Payment[]>();

  private ok<T>(value: T): Observable<T> {
    // Return a copy so callers cannot mutate the in-memory store through a shared reference.
    return of(structuredClone(value)).pipe(delay(LATENCY_MS));
  }

  private fail(status: number, code: string, message: string): Observable<never> {
    return throwError(() => ({ status, error: { statusCode: status, error: code, message } })).pipe(
      delay(LATENCY_MS),
    ) as Observable<never>;
  }

  private id(): string {
    return randomUuid();
  }

  // ─── auth ───
  createGroup(dto: CreateGroupDto): Observable<AuthResult> {
    const groupId = this.id();
    const now = new Date().toISOString();
    const group: Group = {
      id: groupId,
      name: dto.name,
      baseCurrency: dto.baseCurrency,
      inviteCode: 'MOCK1234',
      photoUrl: null,
      simplifyDebts: true,
      createdAt: now,
      updatedAt: now,
    };
    const palette = ['#6366F1', '#059669', '#DC2626', '#F97316', '#0EA5E9'];
    const members: Member[] = dto.memberNames.map((name, i) => ({
      id: this.id(),
      groupId,
      name,
      avatarColor: palette[i % palette.length],
      role: i === 0 ? 'admin' : 'member',
    }));

    this.groups.set(groupId, group);
    this.members.set(groupId, members);
    this.categories.set(groupId, DEFAULT_CATEGORIES.map((c) => ({ ...c, id: this.id(), groupId: null })));
    this.expenses.set(groupId, []);
    this.payments.set(groupId, []);

    return this.ok({ token: `mock-token-${groupId}`, group, member: members[0] });
  }

  lookupGroup(inviteCode: string): Observable<LookupGroupResult> {
    const group = [...this.groups.values()].find((g) => g.inviteCode === inviteCode.toUpperCase());
    if (!group) return this.fail(404, 'INVITE_CODE_NOT_FOUND', 'Mã không đúng');
    return this.ok({
      group: { id: group.id, name: group.name, baseCurrency: group.baseCurrency },
      members: (this.members.get(group.id) ?? []).map((m) => ({
        id: m.id, name: m.name, avatarColor: m.avatarColor,
      })),
    });
  }

  claimMember(groupId: string, dto: ClaimMemberDto): Observable<AuthResult> {
    const group = this.groups.get(groupId);
    if (!group) return this.fail(404, 'GROUP_NOT_FOUND', 'Không tìm thấy nhóm');
    const list = this.members.get(groupId) ?? [];
    let member = list.find((m) => m.id === dto.memberId);
    if (!member && dto.newMemberName) {
      member = { id: this.id(), groupId, name: dto.newMemberName, avatarColor: '#6366F1', role: 'member' };
      list.push(member);
    }
    if (!member) return this.fail(404, 'MEMBER_NOT_FOUND', 'Không tìm thấy thành viên');
    return this.ok({ token: `mock-token-${groupId}`, group, member });
  }

  // ─── group ───
  getGroup(groupId: string) {
    const g = this.groups.get(groupId);
    return g ? this.ok(g) : this.fail(404, 'GROUP_NOT_FOUND', 'Không tìm thấy nhóm');
  }
  updateGroup(groupId: string, dto: UpdateGroupDto) {
    const g = this.groups.get(groupId);
    if (!g) return this.fail(404, 'GROUP_NOT_FOUND', 'Không tìm thấy nhóm');
    Object.assign(g, dto, { updatedAt: new Date().toISOString() });
    return this.ok(g);
  }
  regenerateInviteCode(groupId: string) {
    const g = this.groups.get(groupId);
    if (!g) return this.fail(404, 'GROUP_NOT_FOUND', 'Không tìm thấy nhóm');
    g.inviteCode = 'MOCK' + Math.floor(1000 + Math.random() * 8999);
    return this.ok(g);
  }
  deleteGroup(groupId: string) {
    this.groups.delete(groupId);
    return this.ok(undefined as void);
  }

  // ─── member ───
  listMembers(groupId: string) {
    return this.ok(this.members.get(groupId) ?? []);
  }
  createMember(groupId: string, dto: CreateMemberDto) {
    const list = this.members.get(groupId) ?? [];
    if (list.some((m) => m.name.toLowerCase() === dto.name.toLowerCase())) {
      return this.fail(409, 'MEMBER_NAME_DUPLICATE', 'Nhóm đã có người trùng tên');
    }
    const member: Member = { id: this.id(), groupId, name: dto.name, avatarColor: '#0EA5E9', role: 'member' };
    list.push(member);
    this.members.set(groupId, list);
    return this.ok(member);
  }
  updateMember(groupId: string, memberId: string, dto: UpdateMemberDto) {
    const member = (this.members.get(groupId) ?? []).find((m) => m.id === memberId);
    if (!member) return this.fail(404, 'MEMBER_NOT_FOUND', 'Không tìm thấy thành viên');
    member.name = dto.name;
    return this.ok(member);
  }
  setMemberRole(groupId: string, memberId: string, role: 'admin' | 'member') {
    const member = (this.members.get(groupId) ?? []).find((m) => m.id === memberId);
    if (!member) return this.fail(404, 'MEMBER_NOT_FOUND', 'Không tìm thấy thành viên');
    const admins = (this.members.get(groupId) ?? []).filter((m) => m.role === 'admin');
    if (member.role === 'admin' && role === 'member' && admins.length <= 1) {
      return this.fail(409, 'LAST_ADMIN', 'Nhóm phải còn ít nhất một quản trị');
    }
    member.role = role;
    return this.ok(member);
  }

  deleteMember(groupId: string, memberId: string) {
    const balances = this.computeBalances(groupId);
    const balance = balances.find((b) => b.memberId === memberId)?.balanceMinor ?? 0;
    if (balance !== 0) {
      return this.fail(409, 'MEMBER_HAS_BALANCE', 'Thành viên còn dư nợ');
    }
    this.members.set(groupId, (this.members.get(groupId) ?? []).filter((m) => m.id !== memberId));
    return this.ok(undefined as void);
  }

  // ─── category ───
  listCategories(groupId: string) {
    return this.ok(this.categories.get(groupId) ?? []);
  }
  createCategory(groupId: string, dto: CreateCategoryDto) {
    const list = this.categories.get(groupId) ?? [];
    const category: Category = {
      id: this.id(), groupId, name: dto.name, icon: dto.icon,
      color: dto.color ?? '#94A3B8', sortOrder: list.length + 1,
    };
    list.push(category);
    this.categories.set(groupId, list);
    return this.ok(category);
  }
  updateCategory(groupId: string, id: string, dto: UpdateCategoryDto) {
    const c = (this.categories.get(groupId) ?? []).find((x) => x.id === id);
    if (!c) return this.fail(404, 'CATEGORY_NOT_FOUND', 'Không tìm thấy danh mục');
    Object.assign(c, dto);
    return this.ok(c);
  }
  deleteCategory(groupId: string, id: string) {
    this.categories.set(groupId, (this.categories.get(groupId) ?? []).filter((c) => c.id !== id));
    return this.ok(undefined as void);
  }

  // ─── expense ───
  listExpenses(groupId: string, params: ListExpensesParams = {}) {
    let list = this.expenses.get(groupId) ?? [];
    if (params.categoryId) list = list.filter((e) => e.categoryId === params.categoryId);
    if (params.q) list = list.filter((e) => e.title.toLowerCase().includes((params.q ?? '').toLowerCase()));
    return this.ok(list);
  }
  createExpense(groupId: string, dto: CreateExpenseDto, idempotencyKey: string) {
    const list = this.expenses.get(groupId) ?? [];
    const existing = list.find((e) => e.id === `idem-${idempotencyKey}`);
    if (existing) return this.ok(existing); // idempotency

    let shares;
    try {
      shares = computeShares(dto.amountMinor, dto.splitType, dto.shares);
    } catch (err) {
      const e = err as { code?: string };
      return this.fail(422, e.code ?? 'SPLIT_ERROR', 'Dữ liệu chia tiền không hợp lệ');
    }

    const expense: Expense = {
      id: `idem-${idempotencyKey}`,
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
      createdByMemberId: (this.members.get(groupId) ?? [])[0]?.id ?? '',
      createdAt: new Date().toISOString(),
      receiptId: dto.receiptId ?? null,
      payers: dto.payers,
      shares,
    };
    list.unshift(expense);
    this.expenses.set(groupId, list);
    return this.ok(expense);
  }
  updateExpense(groupId: string, id: string, dto: UpdateExpenseDto) {
    const list = this.expenses.get(groupId) ?? [];
    const index = list.findIndex((e) => e.id === id);
    if (index < 0) return this.fail(404, 'EXPENSE_NOT_FOUND', 'Không tìm thấy khoản chi');
    const shares = computeShares(dto.amountMinor, dto.splitType, dto.shares);
    list[index] = { ...list[index], ...dto, shares, amountBaseMinor: dto.amountMinor };
    return this.ok(list[index]);
  }
  deleteExpense(groupId: string, id: string) {
    this.expenses.set(groupId, (this.expenses.get(groupId) ?? []).filter((e) => e.id !== id));
    return this.ok(undefined as void);
  }
  restoreExpense(_groupId: string, _id: string) {
    return this.fail(404, 'NOT_SUPPORTED', 'Mock không hỗ trợ hoàn tác');
  }

  // ─── payment ───
  listPayments(groupId: string) {
    return this.ok(this.payments.get(groupId) ?? []);
  }
  createPayment(groupId: string, dto: CreatePaymentDto) {
    if (dto.fromMemberId === dto.toMemberId) {
      return this.fail(400, 'PAYMENT_SAME_MEMBER', 'Không thể tự chuyển cho chính mình');
    }
    const payment: Payment = {
      id: this.id(), groupId, ...dto,
      note: dto.note ?? null,
      fxRate: 1, amountBaseMinor: dto.amountMinor,
      createdByMemberId: (this.members.get(groupId) ?? [])[0]?.id ?? '',
      createdAt: new Date().toISOString(),
    };
    const list = this.payments.get(groupId) ?? [];
    list.unshift(payment);
    this.payments.set(groupId, list);
    return this.ok(payment);
  }
  updatePayment(groupId: string, id: string, dto: UpdatePaymentDto) {
    const list = this.payments.get(groupId) ?? [];
    const index = list.findIndex((p) => p.id === id);
    if (index < 0) return this.fail(404, 'PAYMENT_NOT_FOUND', 'Không tìm thấy lượt chuyển tiền');
    list[index] = { ...list[index], ...dto, amountBaseMinor: dto.amountMinor, note: dto.note ?? null };
    return this.ok(list[index]);
  }
  deletePayment(groupId: string, id: string) {
    this.payments.set(groupId, (this.payments.get(groupId) ?? []).filter((p) => p.id !== id));
    return this.ok(undefined as void);
  }

  // ─── receipts (blobs kept in memory) ───
  private receipts = new Map<string, { meta: Receipt; blob: Blob }>();

  uploadReceipt(groupId: string, file: File): Observable<Receipt> {
    const meta: Receipt = {
      id: this.id(),
      groupId,
      originalName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      uploadedByMemberId: (this.members.get(groupId) ?? [])[0]?.id ?? '',
      createdAt: new Date().toISOString(),
    };
    this.receipts.set(meta.id, { meta, blob: file });
    return this.ok(meta);
  }
  downloadReceipt(_groupId: string, receiptId: string): Observable<Blob> {
    const found = this.receipts.get(receiptId);
    if (!found) return this.fail(404, 'RECEIPT_NOT_FOUND', 'Không tìm thấy ảnh');
    return of(found.blob).pipe(delay(LATENCY_MS));
  }
  /**
   * @description Activity log and trash are not simulated: both depend on server-written
   * data (activity_logs, deleted_at). Empty lists keep the screens renderable.
   */
  listActivity(): Observable<ActivityEntry[]> {
    return this.ok([] as ActivityEntry[]);
  }
  listDeletedExpenses(): Observable<DeletedEntry[]> {
    return this.ok([] as DeletedEntry[]);
  }
  listDeletedPayments(): Observable<DeletedEntry[]> {
    return this.ok([] as DeletedEntry[]);
  }
  restorePayment(_groupId: string, _id: string): Observable<Payment> {
    return this.fail(501, 'MOCK_NO_RESTORE', 'Chế độ mock không khôi phục được');
  }

  /**
   * @description Export is not supported in mock mode: PDF/XLSX generation relies on
   * Node-only libraries and backend fonts. Fails explicitly instead of returning an empty file.
   */
  exportSummary(
    _groupId: string,
    _format: ExportFormat,
    _lang: string,
  ): Observable<HttpResponse<Blob>> {
    return this.fail(501, 'EXPORT_NEEDS_BACKEND', 'Chế độ mock không xuất được file');
  }

  deleteReceipt(_groupId: string, receiptId: string): Observable<void> {
    this.receipts.delete(receiptId);
    return this.ok(undefined as void);
  }

  // ─── computed views (same shared-money functions as the backend) ───
  getBalances(groupId: string) {
    return this.ok(this.computeBalances(groupId));
  }
  getSummary(groupId: string): Observable<GroupSummary> {
    const expenses = this.expenses.get(groupId) ?? [];
    const members = this.members.get(groupId) ?? [];
    const perMember = new Map(members.map((m) => [m.id, 0]));
    const perCategory = new Map<string | null, number>();
    for (const e of expenses) {
      for (const p of e.payers) perMember.set(p.memberId, (perMember.get(p.memberId) ?? 0) + p.amountMinor);
      perCategory.set(e.categoryId, (perCategory.get(e.categoryId) ?? 0) + e.amountBaseMinor);
    }
    return this.ok({
      totalSpentMinor: expenses.reduce((s, e) => s + e.amountBaseMinor, 0),
      expenseCount: expenses.length,
      memberCount: members.length,
      perMember: [...perMember].map(([memberId, spentMinor]) => ({ memberId, spentMinor })),
      perCategory: [...perCategory].map(([categoryId, totalMinor]) => ({ categoryId, totalMinor })),
    });
  }
  getMemberDetail(groupId: string, memberId: string): Observable<MemberDetail> {
    const member = (this.members.get(groupId) ?? []).find((m) => m.id === memberId);
    if (!member) return this.fail(404, 'MEMBER_NOT_FOUND', 'Không tìm thấy thành viên');
    const expenses = this.expenses.get(groupId) ?? [];
    const payments = this.payments.get(groupId) ?? [];
    return this.ok({
      member,
      balance: this.computeBalances(groupId).find((b) => b.memberId === memberId) as Balance,
      expensesPaid: expenses.filter((e) => e.payers.some((p) => p.memberId === memberId)),
      expensesBenefited: expenses.filter((e) => e.shares.some((s) => s.memberId === memberId)),
      payments: payments.filter((p) => p.fromMemberId === memberId || p.toMemberId === memberId),
    });
  }

  private computeBalances(groupId: string): Balance[] {
    return calculateBalances(
      (this.members.get(groupId) ?? []).map((m) => ({ id: m.id })),
      this.expenses.get(groupId) ?? [],
      this.payments.get(groupId) ?? [],
    );
  }
}

const DEFAULT_CATEGORIES = [
  { name: 'Food', icon: 'utensils', color: '#F97316', sortOrder: 1 },
  { name: 'Groceries', icon: 'shopping-basket', color: '#22C55E', sortOrder: 2 },
  { name: 'Travel', icon: 'plane', color: '#0EA5E9', sortOrder: 3 },
  { name: 'Transport', icon: 'car', color: '#6366F1', sortOrder: 4 },
  { name: 'Entertainment', icon: 'party-popper', color: '#EC4899', sortOrder: 5 },
  { name: 'Bills', icon: 'receipt', color: '#EF4444', sortOrder: 6 },
  { name: 'Shopping', icon: 'shopping-bag', color: '#A855F7', sortOrder: 7 },
] as const;
