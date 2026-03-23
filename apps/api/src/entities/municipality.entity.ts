import { Entity, Column, OneToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { OrganizationEntity } from './organization.entity';

@Entity('municipality')
export class MunicipalityEntity extends BaseEntity {
  @Column({ type: 'varchar', unique: true, name: 'ibge_code' })
  ibgeCode!: string;

  @Column({ type: 'varchar', length: 2 })
  state!: string;

  @OneToOne(() => OrganizationEntity, (org) => org.municipality, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'organization_id', foreignKeyConstraintName: 'FK_municipality_organization' })
  organization!: OrganizationEntity;
}
