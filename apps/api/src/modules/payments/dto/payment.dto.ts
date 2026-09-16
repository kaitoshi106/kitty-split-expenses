import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';

export class CreatePaymentBody {
  @IsUUID() fromMemberId!: string;
  @IsUUID() toMemberId!: string;

  @IsInt() @Min(1, { message: 'Số tiền phải lớn hơn 0' })
  amountMinor!: number;

  @IsString() @Length(3, 3)
  currency!: string;

  @IsDateString()
  paymentDate!: string;

  @IsOptional() @IsString()
  note?: string | null;
}

export class UpdatePaymentBody extends CreatePaymentBody {}
