import type {
  Category, Expense, Group, Member, Payment, Receipt,
} from '@kitty/shared-types';
import type {
  CategoryEntity, ExpenseEntity, GroupEntity, MemberEntity, PaymentEntity, ReceiptEntity,
} from '../entities';

/**
 * Entity-to-DTO mappers. Entities are never returned directly: they contain cyclic
 * relations, soft-delete columns and internal fields, while DTOs are the explicit API contract.
 */

export const toGroup = (e: GroupEntity): Group => ({
  id: e.id,
  name: e.name,
  baseCurrency: e.baseCurrency,
  inviteCode: e.inviteCode,
  photoUrl: e.photoUrl,
  simplifyDebts: e.simplifyDebts,
  createdAt: e.createdAt.toISOString(),
  updatedAt: e.updatedAt.toISOString(),
});

export const toMember = (e: MemberEntity): Member => ({
  id: e.id,
  groupId: e.groupId,
  name: e.name,
  avatarColor: e.avatarColor,
  role: e.role,
});

export const toCategory = (e: CategoryEntity): Category => ({
  id: e.id,
  groupId: e.groupId,
  name: e.name,
  icon: e.icon,
  color: e.color,
  sortOrder: e.sortOrder,
});

export const toExpense = (e: ExpenseEntity): Expense => ({
  id: e.id,
  groupId: e.groupId,
  categoryId: e.categoryId,
  title: e.title,
  amountMinor: e.amountMinor,
  currency: e.currency,
  fxRate: e.fxRate,
  amountBaseMinor: e.amountBaseMinor,
  splitType: e.splitType,
  expenseDate: e.expenseDate,
  note: e.note,
  createdByMemberId: e.createdByMemberId,
  createdAt: e.createdAt.toISOString(),
  receiptId: e.receiptId,
  payers: (e.payers ?? []).map((p) => ({
    memberId: p.memberId,
    amountMinor: p.amountMinor,
  })),
  shares: (e.shares ?? []).map((s) => ({
    memberId: s.memberId,
    shareValue: s.shareValue,
    amountMinor: s.amountMinor,
  })),
});

export const toPayment = (e: PaymentEntity): Payment => ({
  id: e.id,
  groupId: e.groupId,
  fromMemberId: e.fromMemberId,
  toMemberId: e.toMemberId,
  amountMinor: e.amountMinor,
  currency: e.currency,
  fxRate: e.fxRate,
  amountBaseMinor: e.amountBaseMinor,
  paymentDate: e.paymentDate,
  note: e.note,
  createdByMemberId: e.createdByMemberId,
  createdAt: e.createdAt.toISOString(),
});

export const toReceipt = (e: ReceiptEntity): Receipt => ({
  id: e.id,
  groupId: e.groupId,
  originalName: e.originalName,
  mimeType: e.mimeType,
  sizeBytes: e.sizeBytes,
  uploadedByMemberId: e.uploadedByMemberId,
  createdAt: e.createdAt.toISOString(),
});
