import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('otp_token')
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
