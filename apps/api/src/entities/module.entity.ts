import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { ModuleStatusEntity } from './module-status.entity';

@Entity('module')
export class ModuleEntity extends BaseEntity {
  @Column({ type: 'varchar', unique: true })
  code!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', nullable: true })
  description!: string | null;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive!: boolean;

  @OneToMany(() => ModuleStatusEntity, (moduleStatus) => moduleStatus.module)
  moduleStatuses!: ModuleStatusEntity[];
}
