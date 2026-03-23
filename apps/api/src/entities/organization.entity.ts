import {
  Entity,
  Column,
  OneToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { OrganizationAddressLinkEntity } from './organization-address-link.entity';
import { OrganizationContactLinkEntity } from './organization-contact-link.entity';

@Entity('organization')
export class OrganizationEntity extends BaseEntity {
  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', unique: true })
  cnpj!: string;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive!: boolean;

  // Inverse sides (no @JoinColumn — owned by the subtype entity)
  @OneToOne('MunicipalityEntity', 'organization')
  municipality!: any;

  @OneToOne('HospitalEntity', 'organization')
  hospital!: any;

  @OneToOne('HotelEntity', 'organization')
  hotel!: any;

  // Address and contact links (replace direct FK and ManyToMany)
  @OneToMany(() => OrganizationAddressLinkEntity, (link) => link.organization)
  addressLinks!: OrganizationAddressLinkEntity[];

  @OneToMany(() => OrganizationContactLinkEntity, (link) => link.organization)
  contactLinks!: OrganizationContactLinkEntity[];
}
