import { IsIn, IsString, Length } from 'class-validator';

export class CreateMemberBody {
  @IsString() @Length(1, 60, { message: 'Tên phải từ 1 đến 60 ký tự' })
  name!: string;
}

export class UpdateMemberBody {
  @IsString() @Length(1, 60)
  name!: string;
}

export class UpdateMemberRoleBody {
  @IsIn(['admin', 'member'], { message: "Vai trò phải là 'admin' hoặc 'member'" })
  role!: 'admin' | 'member';
}
