import { IsUUID, IsNotEmpty } from 'class-validator';

export class UpdateTfdStatusDto {
  @IsUUID()
  @IsNotEmpty()
  statusId!: string;
}
