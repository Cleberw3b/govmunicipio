import { IsNumber, IsOptional } from 'class-validator';

export class UpdateTfdCostsDto {
  @IsNumber()
  @IsOptional()
  transportationCost?: number | null;

  @IsNumber()
  @IsOptional()
  foodCost?: number | null;

  @IsNumber()
  @IsOptional()
  hotelCost?: number | null;
}
