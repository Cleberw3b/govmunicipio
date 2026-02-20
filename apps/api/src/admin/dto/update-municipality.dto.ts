import {
  IsString,
  IsOptional,
  IsBoolean,
  Length,
  Matches,
} from 'class-validator';

export class UpdateMunicipalityDto {
  @IsOptional() @IsString() name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, {
    message: 'cnpj must be in format XX.XXX.XXX/XXXX-XX',
  })
  cnpj?: string;

  @IsOptional() @IsString() ibgeCode?: string;
  @IsOptional() @IsString() @Length(2, 2) state?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() street?: string;
  @IsOptional() @IsString() number?: string;
  @IsOptional() @IsString() neighborhood?: string;
  @IsOptional() @IsString() zipCode?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
