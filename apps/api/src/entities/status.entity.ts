import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('status')
export class StatusEntity extends BaseEntity {
  @Column({ type: 'varchar', unique: true })
  code!: string;

  @Column({ type: 'varchar' })
  label!: string;

  @Column({ type: 'int', name: 'sort_order' })
  sortOrder!: number;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive!: boolean;
}
