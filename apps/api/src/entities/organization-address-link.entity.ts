import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';
import { OrganizationEntity } from './organization.entity';
import { AddressEntity } from './address.entity';

@Entity('organization_address')
export class OrganizationAddressLinkEntity {
  @PrimaryColumn({ name: 'organization_id' })
  organizationId!: string;

  @PrimaryColumn({ name: 'address_id' })
  addressId!: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'organization_id' })
  organization!: OrganizationEntity;

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
