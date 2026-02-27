import { IsString, IsNotEmpty, IsIn, IsOptional, IsEmail, Matches } from 'class-validator';

export class CreateMunicipalityUserDto {
  @IsString() @IsNotEmpty() username!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString() @IsNotEmpty() firstName!: string;
  @IsString() @IsNotEmpty() lastName!: string;
  @IsString()
  @Matches(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, { message: 'CPF must be in format 000.000.000-00' })
  cpf!: string;

  @IsString()
  @IsIn(['admin_municipality', 'operator_tfd', 'viewer'])
  role!: string;
}
