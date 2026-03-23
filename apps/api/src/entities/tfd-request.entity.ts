import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { PersonEntity } from './person.entity';
import { DoctorEntity } from './doctor.entity';
import { HospitalEntity } from './hospital.entity';
import { HotelEntity } from './hotel.entity';
import { MunicipalityEntity } from './municipality.entity';
import { PrincipalEntity } from './principal.entity';
import { StatusEntity } from './status.entity';
import { SpecialtyEntity } from './specialty.entity';
import { PickupAddressEntity } from './pickup-address.entity';

@Entity('tfd_request')
export class TfdRequestEntity extends BaseEntity {
  @Column({ type: 'varchar', unique: true, name: 'protocol_number' })
  protocolNumber!: string;

  @Column({ type: 'varchar', name: 'diagnosis_cid', nullable: true })
  diagnosisCid!: string | null;

  @Column({ type: 'text', name: 'procedure_description', nullable: true })
  procedureDescription!: string | null;

  @Column({ type: 'text', nullable: true })
  justification!: string | null;

  @Column({ type: 'date', name: 'request_date', nullable: true })
  requestDate!: Date | null;

  @Column({ type: 'date', nullable: true, name: 'travel_date' })
  travelDate!: Date | null;

  @Column({ type: 'date', nullable: true, name: 'return_date' })
  returnDate!: Date | null;

  @Column({ type: 'varchar', name: 'transport_type', nullable: true })
  transportType!: string | null;

  @Column({
    type: 'decimal',
    nullable: true,
    name: 'estimated_cost',
    precision: 10,
    scale: 2,
  })
  estimatedCost!: number | null;

  @Column({
    type: 'decimal',
    nullable: true,
    name: 'transportation_cost',
    precision: 10,
    scale: 2,
  })
  transportationCost!: number | null;

  @Column({
    type: 'decimal',
    nullable: true,
    name: 'food_cost',
    precision: 10,
    scale: 2,
  })
  foodCost!: number | null;

  @Column({
    type: 'decimal',
    nullable: true,
    name: 'hotel_cost',
    precision: 10,
    scale: 2,
  })
  hotelCost!: number | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'text', nullable: true, name: 'departure_custom_address' })
  departureCustomAddress!: string | null;

  @ManyToOne(() => PersonEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'patient_person_id' })
  patientPerson!: PersonEntity;

  @ManyToOne(() => PersonEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'companion_person_id' })
  companionPerson!: PersonEntity | null;

  @ManyToOne(() => DoctorEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'requesting_doctor_id' })
  requestingDoctor!: DoctorEntity | null;

  @ManyToOne(() => HospitalEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'destination_hospital_id' })
  destinationHospital!: HospitalEntity | null;

  @ManyToOne(() => SpecialtyEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'specialty_id' })
  specialty!: SpecialtyEntity | null;

  @ManyToOne(() => HotelEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'hotel_id' })
  hotel!: HotelEntity | null;

  @ManyToOne(() => PickupAddressEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'pickup_address_id' })
  pickupAddress!: PickupAddressEntity | null;

  @ManyToOne(() => PickupAddressEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'return_pickup_address_id' })
  returnPickupAddress!: PickupAddressEntity | null;

  @ManyToOne(() => MunicipalityEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'municipality_id' })
  municipality!: MunicipalityEntity;

  @ManyToOne(() => PrincipalEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_principal_id' })
  createdByPrincipal!: PrincipalEntity;

  @ManyToOne(() => StatusEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'status_id' })
  status!: StatusEntity;
}
