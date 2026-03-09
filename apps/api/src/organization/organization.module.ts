import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  OrganizationEntity,
  HospitalEntity,
  HotelEntity,
  DoctorEntity,
  SpecialtyEntity,
  MunicipalityEntity,
  PersonEntity,
  PersonIdentificationEntity,
} from '../entities';
import { OrganizationService } from './organization.service';
import { OrganizationController } from './organization.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrganizationEntity,
      HospitalEntity,
      HotelEntity,
      DoctorEntity,
      SpecialtyEntity,
      MunicipalityEntity,
      PersonEntity,
      PersonIdentificationEntity,
    ]),
  ],
  controllers: [OrganizationController],
  providers: [OrganizationService],
  exports: [OrganizationService],
})
export class OrganizationModule {}
