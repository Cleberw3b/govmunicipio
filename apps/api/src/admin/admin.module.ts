import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuthModule } from '../auth/auth.module';
import {
  MunicipalityEntity,
  PrincipalEntity,
  RoleEntity,
} from '../entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([MunicipalityEntity, PrincipalEntity, RoleEntity]),
    AuthModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
