import { IsString, IsNotEmpty, IsIn, MinLength } from 'class-validator';

export class CreateMunicipalityUserDto {
  @IsString() @IsNotEmpty() username!: string;
  @IsString() @MinLength(8) password!: string;
  @IsString() @IsNotEmpty() firstName!: string;
  @IsString() @IsNotEmpty() lastName!: string;
  @IsString() @IsNotEmpty() cpf!: string;

  @IsString()
  @IsIn(['admin_municipality', 'operator_tfd', 'viewer'])
  role!: string;
}
