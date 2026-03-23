/**
 * @deprecated OTP tokens have been moved to Redis.
 * This entity is kept only for the migration that drops the table.
 * Do NOT use in application code — use OtpService (Redis-based) instead.
 */
import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('otp_token')
@Index(['principalId', 'expiresAt'])
export class OtpTokenEntity extends BaseEntity {
  @Column({ name: 'principal_id' })
  principalId!: string;

  @Column({ type: 'varchar', length: 6 })
  code!: string;

  @Column({ type: 'timestamp', name: 'expires_at' })
  expiresAt!: Date;

  @Column({ type: 'timestamp', name: 'used_at', nullable: true })
  usedAt?: Date | null;
}
