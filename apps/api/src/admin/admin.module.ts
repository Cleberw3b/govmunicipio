import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuthModule } from '../auth/auth.module';
import {
  DoctorEntity,
  HospitalEntity,
  MunicipalityEntity,
  PrincipalEntity,
  RoleEntity,
  SpecialtyEntity,
} from '../entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MunicipalityEntity,
      PrincipalEntity,
      RoleEntity,
      SpecialtyEntity,
      HospitalEntity,
      DoctorEntity,
    ]),
    AuthModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
