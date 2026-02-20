import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { PersonModule } from './person/person.module';
import { OrganizationModule } from './organization/organization.module';
import { TfdModule } from './tfd/tfd.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    AuthModule,
    PersonModule,
    OrganizationModule,
    TfdModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
