import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class LoginRequestDto {
  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  @IsUUID()
  @IsOptional()
  organizationId?: string;
}
