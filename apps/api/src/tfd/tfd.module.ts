import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TfdRequestEntity, StatusEntity, MunicipalityEntity } from '../entities';
import { OrganizationModule } from '../organization/organization.module';
import { TfdService } from './tfd.service';
import { TfdController } from './tfd.controller';
import { TfdPdfService } from './tfd-pdf.service';
import { WhatsAppService } from './whatsapp.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TfdRequestEntity, StatusEntity, MunicipalityEntity]),
    OrganizationModule,
  ],
  controllers: [TfdController],
  providers: [TfdService, TfdPdfService, WhatsAppService],
  exports: [TfdService],
})
export class TfdModule {}
