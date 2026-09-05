import type { Group, Member, SplitType } from './domain';

/** Create-group payload; the first entry in memberNames becomes admin. */
export interface CreateGroupDto {
  name: string;
  baseCurrency: string;
  memberNames: string[];
}

export interface LookupGroupDto {
  inviteCode: string;
}

/** Group preview shown before claiming a member; no token is issued yet. */
export interface LookupGroupResult {
  group: Pick<Group, 'id' | 'name' | 'baseCurrency'>;
  members: Pick<Member, 'id' | 'name' | 'avatarColor'>[];
}

/** Identify as an existing member (`memberId`) or create one (`newMemberName`). */
export interface ClaimMemberDto {
  memberId?: string;
  newMemberName?: string;
}

export interface AuthResult {
  token: string;
  group: Group;
  member: Member;
}

export interface UpdateGroupDto {
  name?: string;
  baseCurrency?: string;
  photoUrl?: string | null;
  simplifyDebts?: boolean;
}

export interface CreateMemberDto {
  name: string;
}

export interface UpdateMemberDto {
  name: string;
}

export interface CreateCategoryDto {
  name: string;
  icon: string;
  color?: string;
}

export type UpdateCategoryDto = Partial<CreateCategoryDto>;

export interface ExpensePayerInput {
  memberId: string;
  amountMinor: number;
}

export interface ExpenseShareInput {
  memberId: string;
  /** equal → omitted · exact → amount in minor units · percent → % · weight → weight */
  value?: number;
}

export interface CreateExpenseDto {
  title: string;
  categoryId?: string | null;
  amountMinor: number;
  currency: string;
  expenseDate: string;
  note?: string | null;
  receiptId?: string | null;
  payers: ExpensePayerInput[];
  splitType: SplitType;
  shares: ExpenseShareInput[];
}

export type UpdateExpenseDto = CreateExpenseDto;

export interface CreatePaymentDto {
  fromMemberId: string;
  toMemberId: string;
  amountMinor: number;
  currency: string;
  paymentDate: string;
  note?: string | null;
}

export type UpdatePaymentDto = CreatePaymentDto;

/** Uniform API error body. */
export interface ApiError {
  statusCode: number;
  /** Machine-readable code; clients branch on this, never on `message`. */
  error: string;
  message: string;
  details?: Record<string, unknown>;
}
