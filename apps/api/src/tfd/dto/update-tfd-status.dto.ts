import { IsString, IsNotEmpty, IsIn } from 'class-validator';

export class UpdateTfdStatusDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['in_transit', 'finalized', 'cancelled'], {
    message:
      'statusCode deve ser um dos valores: in_transit, finalized, cancelled',
  })
  statusCode!: string;
}
