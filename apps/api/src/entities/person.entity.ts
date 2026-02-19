import {
  Entity,
  Column,
  ManyToOne,
  OneToOne,
  ManyToMany,
  JoinColumn,
  JoinTable,
} from 'typeorm';
import { Gender } from '@govmunicipio/shared';
import { BaseEntity } from './base.entity';
import { AddressEntity } from './address.entity';
import { PersonIdentificationEntity } from './person-identification.entity';
import { ContactEntity } from './contact.entity';

@Entity('person')
export class PersonEntity extends BaseEntity {
  @Column({ type: 'varchar', name: 'first_name' })
  firstName!: string;

  @Column({ type: 'varchar', name: 'last_name' })
  lastName!: string;

  @Column({ type: 'varchar' })
  gender!: Gender;

  @ManyToOne(() => AddressEntity, { nullable: true, eager: false })
  @JoinColumn({ name: 'address_id' })
  address!: AddressEntity | null;

  @OneToOne(
    () => PersonIdentificationEntity,
    (identification) => identification.person,
  )
  identification!: PersonIdentificationEntity;

  @ManyToMany(() => ContactEntity)
  @JoinTable({
    name: 'person_contact',
    joinColumn: { name: 'person_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'contact_id', referencedColumnName: 'id' },
  })
  contacts!: ContactEntity[];
}
