import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsUUID,
  ValidateIf,
  Matches,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional() @IsString() username?: string;
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional()
  @ValidateIf((o) => o.cpf !== undefined)
  @IsString()
  @Matches(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, { message: 'CPF must be in format 000.000.000-00' })
  cpf?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) roles?: string[];

  @IsOptional()
  @ValidateIf((o) => o.organizationId !== null)
  @IsUUID()
  organizationId?: string | null;
}
