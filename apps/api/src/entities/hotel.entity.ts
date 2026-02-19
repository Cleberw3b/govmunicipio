import { Entity, OneToOne, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { OrganizationEntity } from './organization.entity';
import { MunicipalityEntity } from './municipality.entity';

@Entity('hotel')
export class HotelEntity extends BaseEntity {
  @OneToOne(() => OrganizationEntity)
  @JoinColumn({ name: 'organization_id' })
  organization!: OrganizationEntity;

  @ManyToOne(() => MunicipalityEntity, { nullable: true })
  @JoinColumn({ name: 'municipality_id' })
  municipality!: MunicipalityEntity | null;
}
