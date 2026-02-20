import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsDateString,
  IsBoolean,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Gender, ContactType } from '@govmunicipio/shared';

export class CreateAddressDto {
  @IsString()
  @IsNotEmpty()
  street!: string;

  @IsString()
  @IsNotEmpty()
  number!: string;

  @IsString()
  @IsOptional()
  complement?: string;

  @IsString()
  @IsNotEmpty()
  neighborhood!: string;

  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsString()
  @IsNotEmpty()
  state!: string;

  @IsString()
  @IsNotEmpty()
  zipCode!: string;
}

export class CreateContactDto {
  @IsEnum(ContactType)
  type!: ContactType;

  @IsString()
  @IsNotEmpty()
  value!: string;

  @IsString()
  @IsOptional()
  label?: string;

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}

export class CreatePersonDto {
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsEnum(Gender)
  gender!: Gender;

  @IsString()
  @IsNotEmpty()
  cpf!: string;

  @IsString()
  @IsOptional()
  rg?: string;

  @IsString()
  @IsOptional()
  susCardNumber?: string;

  @IsDateString()
  @IsNotEmpty()
  dateOfBirth!: string;

  @IsString()
  @IsOptional()
  issuingAuthority?: string;

  @ValidateNested()
  @Type(() => CreateAddressDto)
  @IsOptional()
  address?: CreateAddressDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateContactDto)
  @IsOptional()
  contacts?: CreateContactDto[];
}
