import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class UpdateGroupBody {
  @IsOptional() @IsString() @Length(1, 100)
  name?: string;

  @IsOptional() @IsString() @Length(3, 3)
  baseCurrency?: string;

  @IsOptional() @IsString()
  photoUrl?: string | null;

  @IsOptional() @IsBoolean()
  simplifyDebts?: boolean;
}
