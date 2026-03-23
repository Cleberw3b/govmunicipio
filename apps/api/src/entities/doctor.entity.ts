import {
  Entity,
  Column,
  OneToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { PersonEntity } from './person.entity';
import { DoctorSpecialtyLinkEntity } from './doctor-specialty-link.entity';

@Entity('doctor')
export class DoctorEntity extends BaseEntity {
  @Column({ type: 'varchar', unique: true })
  crm!: string;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive!: boolean;

  @OneToOne(() => PersonEntity, (person) => person.doctor, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'person_id', foreignKeyConstraintName: 'FK_doctor_person' })
  person!: PersonEntity;

  // Specialty links (replace ManyToMany)
  @OneToMany(() => DoctorSpecialtyLinkEntity, (link) => link.doctor)
  specialtyLinks!: DoctorSpecialtyLinkEntity[];
}
