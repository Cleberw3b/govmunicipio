import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const databaseUrl = config.get<string>('DATABASE_URL');
        const isProduction = config.get('NODE_ENV') === 'production';

        if (databaseUrl) {
          return {
            type: 'postgres',
            url: databaseUrl,
            ssl: isProduction ? { rejectUnauthorized: false } : false,
            entities: [__dirname + '/../entities/*.entity{.ts,.js}'],
            synchronize: !isProduction,
            logging: !isProduction,
          };
        }

        return {
          type: 'postgres',
          host: config.get('DB_HOST', 'localhost'),
          port: config.get<number>('DB_PORT', 5432),
          username: config.get('DB_USERNAME', 'postgres'),
          password: config.get('DB_PASSWORD', 'postgres'),
          database: config.get('DB_NAME', 'govmunicipio'),
          entities: [__dirname + '/../entities/*.entity{.ts,.js}'],
          synchronize: !isProduction,
          logging: !isProduction,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
