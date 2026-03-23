import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';
import { ModuleEntity } from './module.entity';
import { StatusEntity } from './status.entity';

@Entity('module_status')
@Unique(['module', 'status'])
export class ModuleStatusEntity extends BaseEntity {
  @Column({ type: 'int', name: 'sort_order' })
  sortOrder!: number;

  @ManyToOne(() => ModuleEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'module_id' })
  module!: ModuleEntity;

  @ManyToOne(() => StatusEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'status_id' })
  status!: StatusEntity;
}
