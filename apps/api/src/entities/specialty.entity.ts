import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('specialty')
export class SpecialtyEntity extends BaseEntity {
  @Column({ type: 'varchar', unique: true })
  code!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', nullable: true, name: 'group_code' })
  groupCode!: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'group_name' })
  groupName!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'price' })
  price!: number;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive!: boolean;
}
