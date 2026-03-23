import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { PrincipalEntity } from './principal.entity';

@Entity('notification')
export class NotificationEntity extends BaseEntity {
  @Column({ type: 'varchar' })
  type!: string; // tfd_status_change, user_created, hospital_linked, etc.

  @Column({ type: 'varchar' })
  title!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'boolean', default: false, name: 'is_read' })
  isRead!: boolean;

  @Column({ type: 'varchar', nullable: true, name: 'link_url' })
  linkUrl!: string | null; // e.g., /tfd/requests/{id}

  @ManyToOne(() => PrincipalEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'recipient_id' })
  recipient!: PrincipalEntity;
}
