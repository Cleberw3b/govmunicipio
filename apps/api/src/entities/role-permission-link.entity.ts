import { Entity, PrimaryColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';
import { RoleEntity } from './role.entity';
import { PermissionEntity } from './permission.entity';

@Entity('role_permission')
export class RolePermissionLinkEntity {
  @PrimaryColumn({ name: 'role_id' })
  roleId!: string;

  @PrimaryColumn({ name: 'permission_id' })
  permissionId!: string;

  @ManyToOne(() => RoleEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'role_id' })
  role!: RoleEntity;

  @ManyToOne(() => PermissionEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'permission_id' })
  permission!: PermissionEntity;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt?: Date | null;
}
