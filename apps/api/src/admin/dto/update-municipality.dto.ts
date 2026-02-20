import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNotEmpty,
  Length,
  Matches,
} from 'class-validator';

export class UpdateMunicipalityDto {
  @IsOptional() @IsString() @IsNotEmpty() name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, {
    message: 'cnpj must be in format XX.XXX.XXX/XXXX-XX',
  })
  cnpj?: string;

  @IsOptional() @IsString() @IsNotEmpty() ibgeCode?: string;
  @IsOptional() @IsString() @Length(2, 2) state?: string;
  @IsOptional() @IsString() @IsNotEmpty() city?: string;
  @IsOptional() @IsString() @IsNotEmpty() street?: string;
  @IsOptional() @IsString() @IsNotEmpty() number?: string;
  @IsOptional() @IsString() @IsNotEmpty() neighborhood?: string;
  @IsOptional() @IsString() @IsNotEmpty() zipCode?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
