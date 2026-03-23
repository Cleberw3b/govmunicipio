import { Entity, PrimaryColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';
import { HospitalEntity } from './hospital.entity';
import { SpecialtyEntity } from './specialty.entity';

@Entity('hospital_specialty')
export class HospitalSpecialtyLinkEntity {
  @PrimaryColumn({ name: 'hospital_id' })
  hospitalId!: string;

  @PrimaryColumn({ name: 'specialty_id' })
  specialtyId!: string;

  @ManyToOne(() => HospitalEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'hospital_id' })
  hospital!: HospitalEntity;

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
