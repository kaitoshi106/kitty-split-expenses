import { HttpClient, HttpParams, type HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type {
  ActivityEntry, AuthResult, DeletedEntry, Balance, Category, ClaimMemberDto, CreateCategoryDto, CreateExpenseDto,
  CreateGroupDto, CreateMemberDto, CreatePaymentDto, Expense, Group, GroupSummary,
  LookupGroupResult, Member, MemberDetail, Payment, Receipt, UpdateCategoryDto,
  UpdateExpenseDto, UpdateGroupDto, UpdateMemberDto, UpdatePaymentDto,
} from '@kitty/shared-types';
import type { Observable } from 'rxjs';
import { ApiService, type ExportFormat, type ListExpensesParams } from './api.service';

/**
 * @description ApiService backed by the NestJS API.
 * URLs are relative ('/api/...'): proxied to :3000 in dev, same origin in production.
 */
@Injectable()
export class HttpApiService extends ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api';

  private g(groupId: string) {
    return `${this.base}/groups/${groupId}`;
  }

  createGroup(dto: CreateGroupDto): Observable<AuthResult> {
    return this.http.post<AuthResult>(`${this.base}/groups`, dto);
  }
  lookupGroup(inviteCode: string): Observable<LookupGroupResult> {
    return this.http.post<LookupGroupResult>(`${this.base}/groups/lookup`, { inviteCode });
  }
  claimMember(groupId: string, dto: ClaimMemberDto): Observable<AuthResult> {
    return this.http.post<AuthResult>(`${this.g(groupId)}/claim`, dto);
  }

  getGroup(groupId: string): Observable<Group> {
    return this.http.get<Group>(this.g(groupId));
  }
  updateGroup(groupId: string, dto: UpdateGroupDto): Observable<Group> {
    return this.http.patch<Group>(this.g(groupId), dto);
  }
  regenerateInviteCode(groupId: string): Observable<Group> {
    return this.http.post<Group>(`${this.g(groupId)}/invite-code`, {});
  }
  deleteGroup(groupId: string): Observable<void> {
    return this.http.delete<void>(this.g(groupId));
  }

  listMembers(groupId: string): Observable<Member[]> {
    return this.http.get<Member[]>(`${this.g(groupId)}/members`);
  }
  createMember(groupId: string, dto: CreateMemberDto): Observable<Member> {
    return this.http.post<Member>(`${this.g(groupId)}/members`, dto);
  }
  updateMember(groupId: string, memberId: string, dto: UpdateMemberDto): Observable<Member> {
    return this.http.patch<Member>(`${this.g(groupId)}/members/${memberId}`, dto);
  }
  deleteMember(groupId: string, memberId: string): Observable<void> {
    return this.http.delete<void>(`${this.g(groupId)}/members/${memberId}`);
  }
  setMemberRole(groupId: string, memberId: string, role: 'admin' | 'member') {
    return this.http.patch<Member>(`${this.g(groupId)}/members/${memberId}/role`, { role });
  }

  listCategories(groupId: string): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.g(groupId)}/categories`);
  }
  createCategory(groupId: string, dto: CreateCategoryDto): Observable<Category> {
    return this.http.post<Category>(`${this.g(groupId)}/categories`, dto);
  }
  updateCategory(groupId: string, id: string, dto: UpdateCategoryDto): Observable<Category> {
    return this.http.patch<Category>(`${this.g(groupId)}/categories/${id}`, dto);
  }
  deleteCategory(groupId: string, id: string): Observable<void> {
    return this.http.delete<void>(`${this.g(groupId)}/categories/${id}`);
  }

  listExpenses(groupId: string, params: ListExpensesParams = {}): Observable<Expense[]> {
    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) httpParams = httpParams.set(key, value);
    }
    return this.http.get<Expense[]>(`${this.g(groupId)}/expenses`, { params: httpParams });
  }
  createExpense(groupId: string, dto: CreateExpenseDto, idempotencyKey: string): Observable<Expense> {
    // Guards against double submit: the backend returns the existing record for a reused key.
    return this.http.post<Expense>(`${this.g(groupId)}/expenses`, dto, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  }
  updateExpense(groupId: string, id: string, dto: UpdateExpenseDto): Observable<Expense> {
    return this.http.patch<Expense>(`${this.g(groupId)}/expenses/${id}`, dto);
  }
  deleteExpense(groupId: string, id: string): Observable<void> {
    return this.http.delete<void>(`${this.g(groupId)}/expenses/${id}`);
  }
  restoreExpense(groupId: string, id: string): Observable<Expense> {
    return this.http.post<Expense>(`${this.g(groupId)}/expenses/${id}/restore`, {});
  }

  listPayments(groupId: string): Observable<Payment[]> {
    return this.http.get<Payment[]>(`${this.g(groupId)}/payments`);
  }
  createPayment(groupId: string, dto: CreatePaymentDto): Observable<Payment> {
    return this.http.post<Payment>(`${this.g(groupId)}/payments`, dto);
  }
  updatePayment(groupId: string, id: string, dto: UpdatePaymentDto): Observable<Payment> {
    return this.http.patch<Payment>(`${this.g(groupId)}/payments/${id}`, dto);
  }
  deletePayment(groupId: string, id: string): Observable<void> {
    return this.http.delete<void>(`${this.g(groupId)}/payments/${id}`);
  }

  uploadReceipt(groupId: string, file: File): Observable<Receipt> {
    // Let the browser set the multipart Content-Type; a manual header would lack the boundary.
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<Receipt>(`${this.g(groupId)}/receipts`, form);
  }
  downloadReceipt(groupId: string, receiptId: string): Observable<Blob> {
    return this.http.get(`${this.g(groupId)}/receipts/${receiptId}`, {
      responseType: 'blob',
    });
  }
  deleteReceipt(groupId: string, receiptId: string): Observable<void> {
    return this.http.delete<void>(`${this.g(groupId)}/receipts/${receiptId}`);
  }

  listActivity(groupId: string, before?: string): Observable<ActivityEntry[]> {
    return this.http.get<ActivityEntry[]>(`${this.g(groupId)}/activity`, {
      params: before ? new HttpParams().set('before', before) : undefined,
    });
  }
  listDeletedExpenses(groupId: string): Observable<DeletedEntry[]> {
    return this.http.get<DeletedEntry[]>(`${this.g(groupId)}/expenses/deleted`);
  }
  listDeletedPayments(groupId: string): Observable<DeletedEntry[]> {
    return this.http.get<DeletedEntry[]>(`${this.g(groupId)}/payments/deleted`);
  }
  restorePayment(groupId: string, id: string): Observable<Payment> {
    return this.http.post<Payment>(`${this.g(groupId)}/payments/${id}/restore`, {});
  }

  exportSummary(
    groupId: string,
    format: ExportFormat,
    lang: string,
  ): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.g(groupId)}/export/${format}`, {
      params: new HttpParams().set('lang', lang),
      responseType: 'blob',
      observe: 'response',
    });
  }

  getBalances(groupId: string): Observable<Balance[]> {
    return this.http.get<Balance[]>(`${this.g(groupId)}/balances`);
  }
  getSummary(groupId: string): Observable<GroupSummary> {
    return this.http.get<GroupSummary>(`${this.g(groupId)}/summary`);
  }
  getMemberDetail(groupId: string, memberId: string): Observable<MemberDetail> {
    return this.http.get<MemberDetail>(`${this.g(groupId)}/members/${memberId}/detail`);
  }
}
