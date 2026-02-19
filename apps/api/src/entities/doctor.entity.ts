import {
  Entity,
  Column,
  OneToOne,
  ManyToMany,
  JoinColumn,
  JoinTable,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { PersonEntity } from './person.entity';
import { SpecialtyEntity } from './specialty.entity';

@Entity('doctor')
export class DoctorEntity extends BaseEntity {
  @Column({ type: 'varchar', unique: true })
  crm!: string;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive!: boolean;

  @OneToOne(() => PersonEntity)
  @JoinColumn({ name: 'person_id' })
  person!: PersonEntity;

  @ManyToMany(() => SpecialtyEntity)
  @JoinTable({
    name: 'doctor_specialty',
    joinColumn: { name: 'doctor_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'specialty_id', referencedColumnName: 'id' },
  })
  specialties!: SpecialtyEntity[];
}
