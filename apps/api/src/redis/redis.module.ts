import { Module, Global, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis | null => {
        const logger = new Logger('RedisModule');
        const url = config.get<string>('REDIS_URL');
        const host = config.get<string>('REDIS_HOST');

        if (!url && !host) {
          logger.warn(
            'No REDIS_URL or REDIS_HOST configured — Redis disabled. OTP features will not work.',
          );
          return null;
        }

        const client = url
          ? new Redis(url, { maxRetriesPerRequest: 3, lazyConnect: true })
          : new Redis({
              host,
              port: config.get<number>('REDIS_PORT', 6379),
              maxRetriesPerRequest: 3,
              lazyConnect: true,
            });

        client.on('error', (err) => {
          logger.error(`Redis connection error: ${err.message}`);
        });

        client
          .connect()
          .then(() => logger.log('Redis connected'))
          .catch((err) =>
            logger.warn(`Redis unavailable: ${err.message}. OTP features disabled.`),
          );

        return client;
      },
    },
  ],
  exports: ['REDIS_CLIENT'],
})
export class RedisModule {}
