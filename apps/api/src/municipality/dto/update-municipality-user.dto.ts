import { IsString, IsOptional, IsBoolean, IsIn, MinLength, Matches, ValidateIf } from 'class-validator';

export class UpdateMunicipalityUserDto {
  @IsOptional() @IsString() username?: string;
  @IsOptional() @IsString() @MinLength(8) password?: string;
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional()
  @ValidateIf((o) => o.cpf !== undefined)
  @IsString()
  @Matches(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, { message: 'CPF must be in format 000.000.000-00' })
  cpf?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['admin_municipality', 'operator_tfd', 'viewer'])
  role?: string;
}
