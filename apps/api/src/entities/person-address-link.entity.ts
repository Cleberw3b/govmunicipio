import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';
import { PersonEntity } from './person.entity';
import { AddressEntity } from './address.entity';

@Entity('person_address')
export class PersonAddressLinkEntity {
  @PrimaryColumn({ name: 'person_id' })
  personId!: string;

  @PrimaryColumn({ name: 'address_id' })
  addressId!: string;

  @ManyToOne(() => PersonEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'person_id' })
  person!: PersonEntity;

  @ManyToOne(() => AddressEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'address_id' })
  address!: AddressEntity;

  @Column({ type: 'varchar', nullable: true })
  label!: string | null;

  @Column({ type: 'boolean', default: false, name: 'is_primary' })
  isPrimary!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt?: Date | null;
}
