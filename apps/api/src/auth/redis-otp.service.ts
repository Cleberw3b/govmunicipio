import {
  Injectable,
  Inject,
  Optional,
  Logger,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import Redis from 'ioredis';
import { PrincipalEntity } from '../entities';

const OTP_TTL_SECONDS = 900; // 15 minutes

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @Inject('REDIS_CLIENT')
    @Optional()
    private readonly redis: Redis | null,
  ) {}

  private ensureRedis(): Redis {
    if (!this.redis) {
      throw new ServiceUnavailableException(
        'OTP service is unavailable — Redis not configured',
      );
    }
    return this.redis;
  }

  async requestOtp(username: string): Promise<string> {
    const redis = this.ensureRedis();

    const principal = await this.dataSource
      .getRepository(PrincipalEntity)
      .findOne({ where: { username } });

    if (!principal) {
      throw new NotFoundException(`User "${username}" not found`);
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));

    await redis.set(
      `otp:${principal.id}`,
      JSON.stringify({ code }),
      'EX',
      OTP_TTL_SECONDS,
    );

    this.logger.log(
      `OTP for "${username}": ${code} (expires in ${OTP_TTL_SECONDS}s)`,
    );

    return code;
  }

  async verifyOtp(
    username: string,
    code: string,
    newPassword: string,
  ): Promise<void> {
    const redis = this.ensureRedis();

    const principal = await this.dataSource
      .getRepository(PrincipalEntity)
      .findOne({ where: { username } });

    if (!principal) {
      throw new NotFoundException(`User "${username}" not found`);
    }

    const stored = await redis.get(`otp:${principal.id}`);

    if (!stored) {
      throw new BadRequestException('OTP code has expired or does not exist');
    }

    const parsed = JSON.parse(stored) as { code: string };

    if (parsed.code !== code) {
      throw new BadRequestException('Invalid OTP code');
    }

    await redis.del(`otp:${principal.id}`);

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.dataSource
      .getRepository(PrincipalEntity)
      .update({ id: principal.id }, { passwordHash });

    this.logger.log(`Password updated for "${username}" via OTP`);
  }
}
