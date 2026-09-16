import { Type } from 'class-transformer';
import {
  ArrayMinSize, IsArray, IsDateString, IsIn, IsInt, IsNumber, IsOptional,
  IsString, IsUUID, Length, Min, ValidateNested,
} from 'class-validator';
import type { SplitType } from '@kitty/shared-types';

export class PayerBody {
  @IsUUID() memberId!: string;

  @IsInt() @Min(1, { message: 'Số tiền phải lớn hơn 0' })
  amountMinor!: number;
}

export class ShareBody {
  @IsUUID() memberId!: string;

  /** Meaning depends on split type: equal → omitted, exact → minor units, percent → percentage, weight → weight. */
  @IsOptional() @IsNumber()
  value?: number;
}

export class CreateExpenseBody {
  @IsString() @Length(1, 120)
  title!: string;

  @IsOptional() @IsUUID()
  categoryId?: string | null;

  @IsInt() @Min(1)
  amountMinor!: number;

  @IsString() @Length(3, 3)
  currency!: string;

  @IsDateString({}, { message: 'Ngày phải theo định dạng YYYY-MM-DD' })
  expenseDate!: string;

  @IsOptional() @IsString()
  note?: string | null;

  @IsOptional() @IsUUID()
  receiptId?: string | null;

  // @Type is required for nested validation; without it class-transformer
  // leaves plain objects and the element rules are silently skipped.
  @IsArray() @ArrayMinSize(1)
  @ValidateNested({ each: true }) @Type(() => PayerBody)
  payers!: PayerBody[];

  @IsIn(['equal', 'exact', 'percent', 'weight'])
  splitType!: SplitType;

  @IsArray() @ArrayMinSize(1)
  @ValidateNested({ each: true }) @Type(() => ShareBody)
  shares!: ShareBody[];
}

export class UpdateExpenseBody extends CreateExpenseBody {}
