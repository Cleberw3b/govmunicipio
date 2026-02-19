import {
  Entity,
  Column,
  OneToOne,
  ManyToMany,
  JoinColumn,
  JoinTable,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { PersonEntity } from './person.entity';
import { OrganizationEntity } from './organization.entity';
import { RoleEntity } from './role.entity';

@Entity('principal')
export class PrincipalEntity extends BaseEntity {
  @Column({ type: 'varchar', unique: true })
  username!: string;

  @Column({ type: 'varchar', name: 'password_hash' })
  passwordHash!: string;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive!: boolean;

  @Column({ type: 'timestamp', nullable: true, name: 'last_login' })
  lastLogin!: Date | null;

  @OneToOne(() => PersonEntity, { nullable: true })
  @JoinColumn({ name: 'person_id' })
  person!: PersonEntity | null;

  @OneToOne(() => OrganizationEntity, { nullable: true })
  @JoinColumn({ name: 'organization_id' })
  organization!: OrganizationEntity | null;

  @ManyToMany(() => RoleEntity)
  @JoinTable({
    name: 'principal_role',
    joinColumn: { name: 'principal_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'role_id', referencedColumnName: 'id' },
  })
  roles!: RoleEntity[];

  @ManyToMany(() => OrganizationEntity)
  @JoinTable({
    name: 'principal_organization',
    joinColumn: { name: 'principal_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'organization_id', referencedColumnName: 'id' },
  })
  organizations!: OrganizationEntity[];
}
