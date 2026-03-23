import {
  Entity,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { MunicipalityEntity } from './municipality.entity';
import { HospitalEntity } from './hospital.entity';

@Entity('municipality_hospital')
export class MunicipalityHospitalLinkEntity {
  @PrimaryColumn({ name: 'municipality_id' })
  municipalityId!: string;

  @PrimaryColumn({ name: 'hospital_id' })
  hospitalId!: string;

  @ManyToOne(() => MunicipalityEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'municipality_id' })
  municipality!: MunicipalityEntity;

  @ManyToOne(() => HospitalEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'hospital_id' })
  hospital!: HospitalEntity;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt?: Date | null;
}
