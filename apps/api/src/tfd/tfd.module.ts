import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TfdRequestEntity, StatusEntity, MunicipalityEntity } from '../entities';
import { OrganizationModule } from '../organization/organization.module';
import { TfdService } from './tfd.service';
import { TfdController } from './tfd.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([TfdRequestEntity, StatusEntity, MunicipalityEntity]),
    OrganizationModule,
  ],
  controllers: [TfdController],
  providers: [TfdService],
  exports: [TfdService],
})
export class TfdModule {}
