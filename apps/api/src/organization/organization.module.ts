import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  OrganizationEntity,
  HospitalEntity,
  HotelEntity,
  DoctorEntity,
  SpecialtyEntity,
  MunicipalityEntity,
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
    ]),
  ],
  controllers: [OrganizationController],
  providers: [OrganizationService],
  exports: [OrganizationService],
})
export class OrganizationModule {}
