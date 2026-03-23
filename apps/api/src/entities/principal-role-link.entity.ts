import { Entity, PrimaryColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';
import { PrincipalEntity } from './principal.entity';
import { RoleEntity } from './role.entity';

@Entity('principal_role')
export class PrincipalRoleLinkEntity {
  @PrimaryColumn({ name: 'principal_id' })
  principalId!: string;

  @PrimaryColumn({ name: 'role_id' })
  roleId!: string;

  @ManyToOne(() => PrincipalEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'principal_id' })
  principal!: PrincipalEntity;

  @ManyToOne(() => RoleEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'role_id' })
  role!: RoleEntity;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt?: Date | null;
}
