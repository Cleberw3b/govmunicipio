import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('specialty')
export class SpecialtyEntity extends BaseEntity {
  @Column({ type: 'varchar', unique: true })
  name!: string;

  @Column({ type: 'varchar', nullable: true })
  description!: string | null;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive!: boolean;
}
