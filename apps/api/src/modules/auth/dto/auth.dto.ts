import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString, IsUUID, Length,
} from 'class-validator';

/**
 * @description Request body for creating a group. Validated by the global
 * ValidationPipe, which rejects invalid input with 400 before the service runs.
 */
export class CreateGroupBody {
  @IsString()
  @Length(1, 100, { message: 'Tên nhóm phải từ 1 đến 100 ký tự' })
  name!: string;

  @IsString()
  @Length(3, 3, { message: 'Mã tiền tệ phải có 3 ký tự' })
  baseCurrency!: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Nhóm cần ít nhất một thành viên' })
  @ArrayMaxSize(50)
  @IsString({ each: true })
  memberNames!: string[];
}

export class LookupGroupBody {
  @IsString()
  @Length(4, 16)
  inviteCode!: string;
}

export class ClaimMemberBody {
  @IsOptional()
  @IsUUID()
  memberId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 60)
  newMemberName?: string;
}
