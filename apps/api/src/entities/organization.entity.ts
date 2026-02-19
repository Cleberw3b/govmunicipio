import {
  Entity,
  Column,
  ManyToOne,
  ManyToMany,
  JoinColumn,
  JoinTable,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { AddressEntity } from './address.entity';
import { ContactEntity } from './contact.entity';

@Entity('organization')
export class OrganizationEntity extends BaseEntity {
  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', unique: true })
  cnpj!: string;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive!: boolean;

  @ManyToOne(() => AddressEntity, { nullable: true })
  @JoinColumn({ name: 'address_id' })
  address!: AddressEntity | null;

  @ManyToMany(() => ContactEntity)
  @JoinTable({
    name: 'organization_contact',
    joinColumn: { name: 'organization_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'contact_id', referencedColumnName: 'id' },
  })
  contacts!: ContactEntity[];
}
