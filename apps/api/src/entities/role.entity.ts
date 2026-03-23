import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { RolePermissionLinkEntity } from './role-permission-link.entity';

@Entity('role')
export class RoleEntity extends BaseEntity {
  @Column({ type: 'varchar', unique: true })
  name!: string;

  @Column({ type: 'varchar', nullable: true })
  description!: string | null;

  // Permission links (replace ManyToMany)
  @OneToMany(() => RolePermissionLinkEntity, (link) => link.role)
  permissionLinks!: RolePermissionLinkEntity[];
}
