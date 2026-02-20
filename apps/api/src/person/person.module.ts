import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  PersonEntity,
  PersonIdentificationEntity,
  ContactEntity,
  AddressEntity,
} from '../entities';
import { PersonService } from './person.service';
import { PersonController } from './person.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PersonEntity,
      PersonIdentificationEntity,
      ContactEntity,
      AddressEntity,
    ]),
  ],
  controllers: [PersonController],
  providers: [PersonService],
  exports: [PersonService],
})
export class PersonModule {}
