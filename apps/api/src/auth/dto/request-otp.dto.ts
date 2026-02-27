import { IsString, IsNotEmpty } from 'class-validator';

export class RequestOtpDto {
  @IsString()
  @IsNotEmpty()
  username!: string;
}
