import { Entity, OneToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { OrganizationEntity } from './organization.entity';

@Entity('hotel')
export class HotelEntity extends BaseEntity {
  @OneToOne(() => OrganizationEntity)
  @JoinColumn({ name: 'organization_id' })
  organization!: OrganizationEntity;
}
