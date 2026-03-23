import { Entity, PrimaryColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';
import { DoctorEntity } from './doctor.entity';
import { SpecialtyEntity } from './specialty.entity';

@Entity('doctor_specialty')
export class DoctorSpecialtyLinkEntity {
  @PrimaryColumn({ name: 'doctor_id' })
  doctorId!: string;

  @PrimaryColumn({ name: 'specialty_id' })
  specialtyId!: string;

  @ManyToOne(() => DoctorEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'doctor_id' })
  doctor!: DoctorEntity;

  @ManyToOne(() => SpecialtyEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'specialty_id' })
  specialty!: SpecialtyEntity;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt?: Date | null;
}
