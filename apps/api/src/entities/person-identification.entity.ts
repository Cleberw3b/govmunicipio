import { Entity, Column, OneToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { PersonEntity } from './person.entity';

@Entity('person_identification')
export class PersonIdentificationEntity extends BaseEntity {
  @Column({ type: 'varchar', unique: true })
  cpf!: string;

  @Column({ type: 'varchar', nullable: true })
  rg!: string | null;

  @Column({ type: 'varchar', unique: true, nullable: true, name: 'sus_card_number' })
  susCardNumber!: string | null;

  @Column({ type: 'date', name: 'date_of_birth' })
  dateOfBirth!: Date;

  @Column({ type: 'varchar', nullable: true, name: 'issuing_authority' })
  issuingAuthority!: string | null;

  @OneToOne(() => PersonEntity, { eager: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'person_id', foreignKeyConstraintName: 'FK_person_identification_person' })
  person!: PersonEntity;
}
