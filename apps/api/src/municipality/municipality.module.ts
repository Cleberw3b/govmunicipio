import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MunicipalityController } from './municipality.controller';
import { MunicipalityService } from './municipality.service';
import { AuthModule } from '../auth/auth.module';
import { PrincipalEntity, RoleEntity } from '../entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([PrincipalEntity, RoleEntity]),
    AuthModule,
  ],
  controllers: [MunicipalityController],
  providers: [MunicipalityService],
})
export class MunicipalityModule {}
