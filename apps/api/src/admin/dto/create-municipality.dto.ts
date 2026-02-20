// apps/api/src/admin/dto/create-municipality.dto.ts
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  MinLength,
  ValidateNested,
  IsOptional,
  Length,
  Matches,
} from 'class-validator';

export class MunicipalityDataDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, {
    message: 'cnpj must be in format XX.XXX.XXX/XXXX-XX',
  })
  cnpj!: string;

  @IsString()
  @IsNotEmpty()
  ibgeCode!: string;

  @IsString()
  @Length(2, 2)
  state!: string;

  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsString()
  @IsNotEmpty()
  street!: string;

  @IsString()
  @IsNotEmpty()
  number!: string;

  @IsString()
  @IsOptional()
  neighborhood?: string;

  @IsString()
  @IsOptional()
  zipCode?: string;
}

export class AdminDataDto {
  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsString()
  @IsNotEmpty()
  cpf!: string;
}

export class CreateMunicipalityDto {
  @ValidateNested()
  @Type(() => MunicipalityDataDto)
  municipality!: MunicipalityDataDto;

  @ValidateNested()
  @Type(() => AdminDataDto)
  admin!: AdminDataDto;
}
