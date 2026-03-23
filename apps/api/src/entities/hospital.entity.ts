import {
  Entity,
  Column,
  OneToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { OrganizationEntity } from './organization.entity';
import { HospitalSpecialtyLinkEntity } from './hospital-specialty-link.entity';

@Entity('hospital')
export class HospitalEntity extends BaseEntity {
  @Column({ type: 'varchar', unique: true, name: 'cnes_code' })
  cnesCode!: string;

  @OneToOne(() => OrganizationEntity, (org) => org.hospital, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'organization_id', foreignKeyConstraintName: 'FK_hospital_organization' })
  organization!: OrganizationEntity;

  // Specialty links (replace ManyToMany)
  @OneToMany(() => HospitalSpecialtyLinkEntity, (link) => link.hospital)
  specialtyLinks!: HospitalSpecialtyLinkEntity[];
}
