import { Entity, PrimaryColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Unique } from 'typeorm';
import { OrganizationEntity } from './organization.entity';
import { ContactEntity } from './contact.entity';

@Entity('organization_contact')
@Unique(['contactId'])
export class OrganizationContactLinkEntity {
  @PrimaryColumn({ name: 'organization_id' })
  organizationId!: string;

  @PrimaryColumn({ name: 'contact_id' })
  contactId!: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'organization_id' })
  organization!: OrganizationEntity;

  @ManyToOne(() => ContactEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'contact_id' })
  contact!: ContactEntity;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt?: Date | null;
}
