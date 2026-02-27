import {
  IsString,
  IsOptional,
  IsArray,
  IsUUID,
  IsNotEmpty,
  MinLength,
  Matches,
  ValidateIf,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  firstName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  lastName?: string;

  @IsOptional()
  @ValidateIf((o) => o.cpf !== undefined)
  @IsString()
  @Matches(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, { message: 'CPF must be in format 000.000.000-00' })
  cpf?: string;

  @IsArray()
  @IsString({ each: true })
  roles!: string[];

  @IsOptional()
  @ValidateIf((o) => o.organizationId !== null)
  @IsUUID()
  organizationId?: string | null;
}
