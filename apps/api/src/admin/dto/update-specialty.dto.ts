import { IsString, IsOptional, IsBoolean, MaxLength, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateSpecialtyDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  price?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
