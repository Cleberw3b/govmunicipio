import {
  Entity,
  Column,
  OneToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { PersonEntity } from './person.entity';
import { OrganizationEntity } from './organization.entity';
import { PrincipalRoleLinkEntity } from './principal-role-link.entity';
import { PrincipalOrganizationLinkEntity } from './principal-organization-link.entity';

@Entity('principal')
export class PrincipalEntity extends BaseEntity {
  @Column({ type: 'varchar', unique: true })
  username!: string;

  @Column({ type: 'varchar', name: 'password_hash' })
  passwordHash!: string;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive!: boolean;

  @Column({ type: 'varchar', nullable: true })
  email?: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone?: string | null;

  @Column({ type: 'timestamp', nullable: true, name: 'last_login' })
  lastLogin!: Date | null;

  @OneToOne(() => PersonEntity, (person) => person.principal, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'person_id', foreignKeyConstraintName: 'FK_principal_person' })
  person!: PersonEntity | null;

  @OneToOne(() => OrganizationEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'organization_id', foreignKeyConstraintName: 'FK_principal_organization' })
  organization!: OrganizationEntity | null;

  // Role and organization links (replace ManyToMany)
  @OneToMany(() => PrincipalRoleLinkEntity, (link) => link.principal)
  roleLinks!: PrincipalRoleLinkEntity[];

  @OneToMany(() => PrincipalOrganizationLinkEntity, (link) => link.principal)
  organizationLinks!: PrincipalOrganizationLinkEntity[];
}
