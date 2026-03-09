import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { MunicipalityEntity } from './municipality.entity';

@Entity('pickup_address')
export class PickupAddressEntity extends BaseEntity {
  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar' })
  street!: string;

  @Column({ type: 'varchar' })
  number!: string;

  @Column({ type: 'varchar', nullable: true })
  complement!: string | null;

  @Column({ type: 'varchar' })
  neighborhood!: string;

  @Column({ type: 'varchar' })
  city!: string;

  @Column({ type: 'varchar', length: 2 })
  state!: string;

  @ManyToOne(() => MunicipalityEntity)
  @JoinColumn({ name: 'municipality_id' })
  municipality!: MunicipalityEntity;
}
