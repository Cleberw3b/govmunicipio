import { Entity, Column, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('permission')
@Unique(['resource', 'action'])
export class PermissionEntity extends BaseEntity {
  @Column({ type: 'varchar' })
  resource!: string;

  @Column({ type: 'varchar' })
  action!: string;

  @Column({ type: 'varchar', nullable: true })
  description!: string | null;
}
