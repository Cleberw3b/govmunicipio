import { IsString, IsNotEmpty, IsOptional, MaxLength, IsNumber, Min, Matches } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSpecialtyDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{2}\.\d{2}\.\d{2}\.\d{3}-\d$/, {
    message: 'code must follow SIGTAP format: XX.XX.XX.XXX-X',
  })
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  price?: number;
}
