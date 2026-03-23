import { Entity, PrimaryColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';
import { PrincipalEntity } from './principal.entity';
import { OrganizationEntity } from './organization.entity';

@Entity('principal_organization')
export class PrincipalOrganizationLinkEntity {
  @PrimaryColumn({ name: 'principal_id' })
  principalId!: string;

  @PrimaryColumn({ name: 'organization_id' })
  organizationId!: string;

  @ManyToOne(() => PrincipalEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'principal_id' })
  principal!: PrincipalEntity;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'organization_id' })
  organization!: OrganizationEntity;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt?: Date | null;
}
