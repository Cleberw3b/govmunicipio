import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('address')
export class AddressEntity extends BaseEntity {
  @Column({ type: 'varchar' })
  street!: string;

  @Column({ type: 'varchar' })
  number!: string;

  @Column({ type: 'varchar', nullable: true })
  complement!: string | null;

  @Column({ type: 'varchar' })
  neighborhood!: string;

  @Column({ type: 'varchar' })
  city!: string;

  @Column({ type: 'varchar', length: 2 })
  state!: string;

  @Column({ type: 'varchar', name: 'zip_code' })
  zipCode!: string;
}
