import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('audit_log')
export class AuditLogEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'actor_id' })
  actorId!: string;

  @Column({ type: 'varchar' })
  action!: string; // create, update, delete

  @Column({ type: 'varchar', name: 'entity_type' })
  entityType!: string; // municipality, hospital, tfd_request, etc.

  @Column({ type: 'uuid', name: 'entity_id' })
  entityId!: string;

  @Column({ type: 'jsonb', nullable: true, name: 'old_values' })
  oldValues!: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true, name: 'new_values' })
  newValues!: Record<string, any> | null;

  @Column({ type: 'varchar', nullable: true, name: 'ip_address' })
  ipAddress!: string | null;
}
