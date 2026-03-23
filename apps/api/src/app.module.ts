import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { PersonModule } from './person/person.module';
import { OrganizationModule } from './organization/organization.module';
import { TfdModule } from './tfd/tfd.module';
import { AdminModule } from './admin/admin.module';
import { MunicipalityModule } from './municipality/municipality.module';
import { NotificationModule } from './notification/notification.module';
import { AuditModule } from './audit/audit.module';
import { LoggingInterceptor } from './common';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    RedisModule,
    AuthModule,
    PersonModule,
    OrganizationModule,
    TfdModule,
    AdminModule,
    MunicipalityModule,
    NotificationModule,
    AuditModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
