import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsDateString,
  IsOptional,
  IsArray,
} from 'class-validator';
import { Gender } from '@govmunicipio/shared';

export class CreateDoctorDto {
  @IsString()
  @IsNotEmpty()
  crm!: string;

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

  @IsDateString()
  @IsNotEmpty()
  dateOfBirth!: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  specialtyIds?: string[];
}
