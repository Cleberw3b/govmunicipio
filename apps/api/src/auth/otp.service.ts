import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { OtpTokenEntity } from '../entities/otp-token.entity';
import { PrincipalEntity } from '../entities';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async requestOtp(username: string): Promise<string> {
    const principal = await this.dataSource
      .getRepository(PrincipalEntity)
      .findOne({ where: { username } });

    if (!principal) {
      throw new NotFoundException(`User "${username}" not found`);
    }

    const otpRepo = this.dataSource.getRepository(OtpTokenEntity);

    // Invalidate previous unused OTPs for this principal
    await otpRepo
      .createQueryBuilder()
      .update(OtpTokenEntity)
      .set({ usedAt: new Date() })
      .where('principal_id = :id AND used_at IS NULL', { id: principal.id })
      .execute();

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await otpRepo.save(
      otpRepo.create({
        principalId: principal.id,
        code,
        expiresAt,
      }),
    );

    this.logger.log(`OTP for "${username}": ${code} (expires at ${expiresAt.toISOString()})`);

    return code;
  }

  async verifyOtp(
    username: string,
    code: string,
    newPassword: string,
  ): Promise<void> {
    const principal = await this.dataSource
      .getRepository(PrincipalEntity)
      .findOne({ where: { username } });

    if (!principal) {
      throw new NotFoundException(`User "${username}" not found`);
    }

    const otpRepo = this.dataSource.getRepository(OtpTokenEntity);

    const token = await otpRepo.findOne({
      where: { principalId: principal.id, code },
      order: { createdAt: 'DESC' },
    });

    if (!token) {
      throw new BadRequestException('Invalid OTP code');
    }

    if (token.usedAt) {
      throw new BadRequestException('OTP code has already been used');
    }

    if (token.expiresAt < new Date()) {
      throw new BadRequestException('OTP code has expired');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.dataSource.transaction(async (manager) => {
      await manager.update(OtpTokenEntity, { id: token.id }, { usedAt: new Date() });
      await manager.update(PrincipalEntity, { id: principal.id }, { passwordHash });
    });

    this.logger.log(`Password updated for "${username}" via OTP`);
  }
}
