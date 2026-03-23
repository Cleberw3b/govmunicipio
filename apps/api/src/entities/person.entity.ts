import {
  Entity,
  Column,
  OneToOne,
  OneToMany,
} from 'typeorm';
import { Gender } from '@govmunicipio/shared';
import { BaseEntity } from './base.entity';
import { PersonIdentificationEntity } from './person-identification.entity';
import { PersonAddressLinkEntity } from './person-address-link.entity';
import { PersonContactLinkEntity } from './person-contact-link.entity';

@Entity('person')
export class PersonEntity extends BaseEntity {
  @Column({ type: 'varchar', name: 'first_name' })
  firstName!: string;

  @Column({ type: 'varchar', name: 'last_name' })
  lastName!: string;

  @Column({ type: 'varchar' })
  gender!: Gender;

  @OneToOne(
    () => PersonIdentificationEntity,
    (identification) => identification.person,
  )
  identification!: PersonIdentificationEntity;

  // Inverse sides (no @JoinColumn — owned by the other entity)
  @OneToOne('PrincipalEntity', 'person')
  principal!: any;

  @OneToOne('DoctorEntity', 'person')
  doctor!: any;

  // Address and contact links (replace direct FK and ManyToMany)
  @OneToMany(() => PersonAddressLinkEntity, (link) => link.person)
  addressLinks!: PersonAddressLinkEntity[];

  @OneToMany(() => PersonContactLinkEntity, (link) => link.person)
  contactLinks!: PersonContactLinkEntity[];
}
