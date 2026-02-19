import {
  Entity,
  Column,
  OneToOne,
  ManyToMany,
  JoinColumn,
  JoinTable,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { OrganizationEntity } from './organization.entity';
import { SpecialtyEntity } from './specialty.entity';

@Entity('hospital')
export class HospitalEntity extends BaseEntity {
  @Column({ type: 'varchar', unique: true, name: 'cnes_code' })
  cnesCode!: string;

  @OneToOne(() => OrganizationEntity)
  @JoinColumn({ name: 'organization_id' })
  organization!: OrganizationEntity;

  @ManyToMany(() => SpecialtyEntity)
  @JoinTable({
    name: 'hospital_specialty',
    joinColumn: { name: 'hospital_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'specialty_id', referencedColumnName: 'id' },
  })
  specialties!: SpecialtyEntity[];
}
