import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MunicipalityController } from './municipality.controller';
import { MunicipalityService } from './municipality.service';
import { PrincipalEntity, RoleEntity } from '../entities';

@Module({
  imports: [TypeOrmModule.forFeature([PrincipalEntity, RoleEntity])],
  controllers: [MunicipalityController],
  providers: [MunicipalityService],
})
export class MunicipalityModule {}
