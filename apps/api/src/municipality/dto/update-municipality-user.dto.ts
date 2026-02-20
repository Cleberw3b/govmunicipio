import { IsString, IsOptional, IsBoolean, IsIn, MinLength } from 'class-validator';

export class UpdateMunicipalityUserDto {
  @IsOptional() @IsString() username?: string;
  @IsOptional() @IsString() @MinLength(8) password?: string;
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() cpf?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['admin_municipality', 'operator_tfd', 'viewer'])
  role?: string;
}
