import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsEnum,
  IsNumber,
  IsDateString,
} from 'class-validator';
import { TransportType } from '@govmunicipio/shared';

export class CreateTfdRequestDto {
  @IsUUID()
  @IsNotEmpty()
  patientPersonId!: string;

  @IsUUID()
  @IsOptional()
  companionPersonId?: string;

  @IsUUID()
  @IsNotEmpty()
  requestingDoctorId!: string;

  @IsUUID()
  @IsNotEmpty()
  destinationHospitalId!: string;

  @IsUUID()
  @IsOptional()
  hotelId?: string;

  @IsString()
  @IsNotEmpty()
  diagnosisCid!: string;

  @IsString()
  @IsNotEmpty()
  procedureDescription!: string;

  @IsString()
  @IsNotEmpty()
  justification!: string;

  @IsDateString()
  @IsNotEmpty()
  requestDate!: string;

  @IsDateString()
  @IsOptional()
  travelDate?: string;

  @IsDateString()
  @IsOptional()
  returnDate?: string;

  @IsEnum(TransportType)
  transportType!: TransportType;

  @IsNumber()
  @IsOptional()
  estimatedCost?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
