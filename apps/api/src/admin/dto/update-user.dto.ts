import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsUUID,
  ValidateIf,
  MinLength,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional() @IsString() username?: string;
  @IsOptional() @IsString() @MinLength(8) password?: string;
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() cpf?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) roles?: string[];

  @IsOptional()
  @ValidateIf((o) => o.organizationId !== null)
  @IsUUID()
  organizationId?: string | null;
}
