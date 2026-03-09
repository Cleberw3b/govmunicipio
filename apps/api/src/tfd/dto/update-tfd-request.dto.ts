import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsNumber,
  IsDateString,
} from 'class-validator';
import { TransportType } from '@govmunicipio/shared';

export class UpdateTfdRequestDto {
  @IsUUID()
  @IsOptional()
  companionPersonId?: string | null;

  @IsUUID()
  @IsOptional()
  requestingDoctorId?: string;

  @IsUUID()
  @IsOptional()
  destinationHospitalId?: string;

  @IsUUID()
  @IsOptional()
  specialtyId?: string | null;

  @IsUUID()
  @IsOptional()
  hotelId?: string | null;

  @IsUUID()
  @IsOptional()
  pickupAddressId?: string | null;

  @IsString()
  @IsOptional()
  diagnosisCid?: string;

  @IsString()
  @IsOptional()
  procedureDescription?: string;

  @IsString()
  @IsOptional()
  justification?: string;

  @IsDateString()
  @IsOptional()
  requestDate?: string;

  @IsDateString()
  @IsOptional()
  travelDate?: string | null;

  @IsDateString()
  @IsOptional()
  returnDate?: string | null;

  @IsEnum(TransportType)
  @IsOptional()
  transportType?: TransportType;

  @IsNumber()
  @IsOptional()
  estimatedCost?: number | null;

  @IsNumber()
  @IsOptional()
  transportationCost?: number | null;

  @IsNumber()
  @IsOptional()
  foodCost?: number | null;

  @IsNumber()
  @IsOptional()
  hotelCost?: number | null;

  @IsString()
  @IsOptional()
  notes?: string | null;
}
