import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { PersonEntity } from './person.entity';
import { DoctorEntity } from './doctor.entity';
import { HospitalEntity } from './hospital.entity';
import { HotelEntity } from './hotel.entity';
import { MunicipalityEntity } from './municipality.entity';
import { PrincipalEntity } from './principal.entity';
import { StatusEntity } from './status.entity';

@Entity('tfd_request')
export class TfdRequestEntity extends BaseEntity {
  @Column({ type: 'varchar', unique: true, name: 'protocol_number' })
  protocolNumber!: string;

  @Column({ type: 'varchar', name: 'diagnosis_cid' })
  diagnosisCid!: string;

  @Column({ type: 'text', name: 'procedure_description' })
  procedureDescription!: string;

  @Column({ type: 'text' })
  justification!: string;

  @Column({ type: 'date', name: 'request_date' })
  requestDate!: Date;

  @Column({ type: 'date', nullable: true, name: 'travel_date' })
  travelDate!: Date | null;

  @Column({ type: 'date', nullable: true, name: 'return_date' })
  returnDate!: Date | null;

  @Column({ type: 'varchar', name: 'transport_type' })
  transportType!: string;

  @Column({
    type: 'decimal',
    nullable: true,
    name: 'estimated_cost',
    precision: 10,
    scale: 2,
  })
  estimatedCost!: number | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @ManyToOne(() => PersonEntity)
  @JoinColumn({ name: 'patient_person_id' })
  patientPerson!: PersonEntity;

  @ManyToOne(() => PersonEntity, { nullable: true })
  @JoinColumn({ name: 'companion_person_id' })
  companionPerson!: PersonEntity | null;

  @ManyToOne(() => DoctorEntity)
  @JoinColumn({ name: 'requesting_doctor_id' })
  requestingDoctor!: DoctorEntity;

  @ManyToOne(() => HospitalEntity)
  @JoinColumn({ name: 'destination_hospital_id' })
  destinationHospital!: HospitalEntity;

  @ManyToOne(() => HotelEntity, { nullable: true })
  @JoinColumn({ name: 'hotel_id' })
  hotel!: HotelEntity | null;

  @ManyToOne(() => MunicipalityEntity)
  @JoinColumn({ name: 'municipality_id' })
  municipality!: MunicipalityEntity;

  @ManyToOne(() => PrincipalEntity)
  @JoinColumn({ name: 'created_by_principal_id' })
  createdByPrincipal!: PrincipalEntity;

  @ManyToOne(() => StatusEntity)
  @JoinColumn({ name: 'status_id' })
  status!: StatusEntity;
}
