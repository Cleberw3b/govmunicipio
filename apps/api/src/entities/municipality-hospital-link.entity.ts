import { Entity, PrimaryColumn } from 'typeorm';

@Entity('municipality_hospital')
export class MunicipalityHospitalLinkEntity {
  @PrimaryColumn({ name: 'municipality_id' })
  municipalityId!: string;

  @PrimaryColumn({ name: 'hospital_id' })
  hospitalId!: string;
}
