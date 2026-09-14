import { IsOptional, IsString, Length } from 'class-validator';

export class CreateCategoryBody {
  @IsString() @Length(1, 40)
  name!: string;

  @IsString() @Length(1, 40)
  icon!: string;

  @IsOptional() @IsString() @Length(7, 7)
  color?: string;
}

export class UpdateCategoryBody {
  @IsOptional() @IsString() @Length(1, 40)
  name?: string;

  @IsOptional() @IsString() @Length(1, 40)
  icon?: string;

  @IsOptional() @IsString() @Length(7, 7)
  color?: string;
}
