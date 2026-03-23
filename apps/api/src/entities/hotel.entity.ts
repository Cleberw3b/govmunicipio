import { Entity, OneToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { OrganizationEntity } from './organization.entity';

@Entity('hotel')
export class HotelEntity extends BaseEntity {
  @OneToOne(() => OrganizationEntity, (org) => org.hotel, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'organization_id', foreignKeyConstraintName: 'FK_hotel_organization' })
  organization!: OrganizationEntity;
}
