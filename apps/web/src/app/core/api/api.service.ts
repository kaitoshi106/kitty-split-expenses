import type {
  ActivityEntry, AuthResult, DeletedEntry, Balance, Category, ClaimMemberDto, CreateCategoryDto, CreateExpenseDto,
  CreateGroupDto, CreateMemberDto, CreatePaymentDto, Expense, Group, GroupSummary,
  LookupGroupResult, Member, MemberDetail, Payment, Receipt, UpdateCategoryDto,
  UpdateExpenseDto, UpdateGroupDto, UpdateMemberDto, UpdatePaymentDto,
} from '@kitty/shared-types';
import type { HttpResponse } from '@angular/common/http';
import type { Observable } from 'rxjs';

/** File formats available for the summary export. */
export type ExportFormat = 'pdf' | 'xlsx';

export interface ListExpensesParams {
  categoryId?: string;
  memberId?: string;
  q?: string;
  from?: string;
  to?: string;
}

/**
 * @description Contract between the UI and the data layer. Components depend only on this
 * abstraction; the concrete implementation (HTTP or in-memory mock) is chosen in app.config.ts.
 */
export abstract class ApiService {
  // ─── auth (no token required) ───
  abstract createGroup(dto: CreateGroupDto): Observable<AuthResult>;
  abstract lookupGroup(inviteCode: string): Observable<LookupGroupResult>;
  abstract claimMember(groupId: string, dto: ClaimMemberDto): Observable<AuthResult>;

  // ─── group ───
  abstract getGroup(groupId: string): Observable<Group>;
  abstract updateGroup(groupId: string, dto: UpdateGroupDto): Observable<Group>;
  abstract regenerateInviteCode(groupId: string): Observable<Group>;
  abstract deleteGroup(groupId: string): Observable<void>;

  // ─── member ───
  abstract listMembers(groupId: string): Observable<Member[]>;
  abstract createMember(groupId: string, dto: CreateMemberDto): Observable<Member>;
  abstract updateMember(groupId: string, memberId: string, dto: UpdateMemberDto): Observable<Member>;
  abstract deleteMember(groupId: string, memberId: string): Observable<void>;
  abstract setMemberRole(
    groupId: string,
    memberId: string,
    role: 'admin' | 'member',
  ): Observable<Member>;

  // ─── category ───
  abstract listCategories(groupId: string): Observable<Category[]>;
  abstract createCategory(groupId: string, dto: CreateCategoryDto): Observable<Category>;
  abstract updateCategory(groupId: string, id: string, dto: UpdateCategoryDto): Observable<Category>;
  abstract deleteCategory(groupId: string, id: string): Observable<void>;

  // ─── expense ───
  abstract listExpenses(groupId: string, params?: ListExpensesParams): Observable<Expense[]>;
  abstract createExpense(groupId: string, dto: CreateExpenseDto, idempotencyKey: string): Observable<Expense>;
  abstract updateExpense(groupId: string, id: string, dto: UpdateExpenseDto): Observable<Expense>;
  abstract deleteExpense(groupId: string, id: string): Observable<void>;
  abstract restoreExpense(groupId: string, id: string): Observable<Expense>;

  // ─── payment ───
  abstract listPayments(groupId: string): Observable<Payment[]>;
  abstract createPayment(groupId: string, dto: CreatePaymentDto): Observable<Payment>;
  abstract updatePayment(groupId: string, id: string, dto: UpdatePaymentDto): Observable<Payment>;
  abstract deletePayment(groupId: string, id: string): Observable<void>;

  // ─── receipts ───
  abstract uploadReceipt(groupId: string, file: File): Observable<Receipt>;
  /** Returns a Blob because the image endpoint requires an auth header, which <img src> cannot send. */
  abstract downloadReceipt(groupId: string, receiptId: string): Observable<Blob>;
  abstract deleteReceipt(groupId: string, receiptId: string): Observable<void>;

  // ─── computed views ───
  abstract getBalances(groupId: string): Observable<Balance[]>;
  abstract getSummary(groupId: string): Observable<GroupSummary>;
  abstract getMemberDetail(groupId: string, memberId: string): Observable<MemberDetail>;

  // ─── activity & trash ───
  abstract listActivity(groupId: string, before?: string): Observable<ActivityEntry[]>;
  abstract listDeletedExpenses(groupId: string): Observable<DeletedEntry[]>;
  abstract listDeletedPayments(groupId: string): Observable<DeletedEntry[]>;
  abstract restorePayment(groupId: string, id: string): Observable<Payment>;

  // ─── export ───
  /**
   * @description Downloads the group summary as a file.
   * @param groupId - Group to export.
   * @param format - Output format.
   * @param lang - In-app language; passed explicitly because Accept-Language reflects the browser, not the user's choice.
   * @returns The full response, since the server-chosen file name is in Content-Disposition.
   */
  abstract exportSummary(
    groupId: string,
    format: ExportFormat,
    lang: string,
  ): Observable<HttpResponse<Blob>>;
}
