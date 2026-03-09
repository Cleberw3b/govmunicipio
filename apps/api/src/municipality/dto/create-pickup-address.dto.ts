import { IsString, IsOptional, Length } from 'class-validator';

export class CreatePickupAddressDto {
  @IsString()
  name!: string;

  @IsString()
  street!: string;

  @IsString()
  number!: string;

  @IsString()
  @IsOptional()
  complement?: string | null;

  @IsString()
  neighborhood!: string;

  @IsString()
  city!: string;

  @IsString()
  @Length(2, 2)
  state!: string;
}
