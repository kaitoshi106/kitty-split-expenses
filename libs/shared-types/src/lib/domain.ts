/**
 * Domain types shared by the Angular and NestJS apps.
 * All monetary fields are integer minor units.
 */

export type MemberRole = 'admin' | 'member';

/** equal: even split · exact: fixed amounts · percent: percentages · weight: proportional weights */
export type SplitType = 'equal' | 'exact' | 'percent' | 'weight';

export interface Group {
  id: string;
  name: string;
  baseCurrency: string;
  inviteCode: string;
  photoUrl: string | null;
  simplifyDebts: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Member {
  id: string;
  groupId: string;
  name: string;
  avatarColor: string;
  role: MemberRole;
}

export interface Category {
  id: string;
  /** null for built-in categories visible to every group. */
  groupId: string | null;
  name: string;
  icon: string;
  color: string;
  sortOrder: number;
}

export interface ExpensePayer {
  memberId: string;
  amountMinor: number;
}

export interface ExpenseShare {
  memberId: string;
  /** The entered value: equal→null · exact→amount · percent→33.3333 · weight→2 */
  shareValue: number | null;
  amountMinor: number;
}

export interface Expense {
  id: string;
  groupId: string;
  categoryId: string | null;
  title: string;
  amountMinor: number;
  currency: string;
  fxRate: number;
  amountBaseMinor: number;
  splitType: SplitType;
  expenseDate: string; // YYYY-MM-DD
  note: string | null;
  createdByMemberId: string;
  createdAt: string;
  /** Attached receipt image, or null. */
  receiptId: string | null;
  payers: ExpensePayer[];
  shares: ExpenseShare[];
}

export interface Receipt {
  id: string;
  groupId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedByMemberId: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  groupId: string;
  fromMemberId: string;
  toMemberId: string;
  amountMinor: number;
  currency: string;
  fxRate: number;
  amountBaseMinor: number;
  paymentDate: string;
  note: string | null;
  createdByMemberId: string;
  createdAt: string;
}

/** A member's derived net balance; > 0 means the group owes them. Never persisted. */
export interface Balance {
  memberId: string;
  paidMinor: number;
  owedMinor: number;
  sentMinor: number;
  receivedMinor: number;
  balanceMinor: number;
}

/** One suggested settle-up transfer. */
export interface Transfer {
  fromMemberId: string;
  toMemberId: string;
  amountMinor: number;
}

/**
 * An activity log entry.
 * `action` is "<entity>.<verb>" (expense.created, member.removed, ...). A string
 * rather than an enum so new backend actions degrade to the raw key on older clients.
 */
export interface ActivityEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  /** Current name of the actor; null if they left the group. */
  actorName: string | null;
  /** Data captured at the time, e.g. { title, amountMinor }, since the record may since be deleted. */
  snapshot: Record<string, unknown> | null;
  createdAt: string;
}

/** A soft-deleted, restorable record. */
export interface DeletedEntry {
  id: string;
  /** Selects the restore endpoint. */
  kind: 'expense' | 'payment';
  title: string;
  amountMinor: number;
  currency: string;
  /** Transaction date (YYYY-MM-DD). */
  entryDate: string;
  /** Deletion time (ISO). */
  deletedAt: string;
}

export interface GroupSummary {
  totalSpentMinor: number;
  expenseCount: number;
  memberCount: number;
  perMember: { memberId: string; spentMinor: number }[];
  perCategory: { categoryId: string | null; totalMinor: number }[];
}

export interface MemberDetail {
  member: Member;
  balance: Balance;
  expensesPaid: Expense[];
  expensesBenefited: Expense[];
  payments: Payment[];
}
