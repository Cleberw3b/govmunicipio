import { Entity, Column } from 'typeorm';
import { ContactType } from '@govmunicipio/shared';
import { BaseEntity } from './base.entity';

@Entity('contact')
export class ContactEntity extends BaseEntity {
  @Column({ type: 'varchar' })
  type!: ContactType;

  @Column({ type: 'varchar' })
  value!: string;

  @Column({ type: 'varchar', nullable: true })
  label!: string | null;

  @Column({ type: 'boolean', default: false, name: 'is_primary' })
  isPrimary!: boolean;
}
