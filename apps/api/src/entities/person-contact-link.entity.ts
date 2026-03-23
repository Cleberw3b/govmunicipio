import { Entity, PrimaryColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Unique } from 'typeorm';
import { PersonEntity } from './person.entity';
import { ContactEntity } from './contact.entity';

@Entity('person_contact')
@Unique(['contactId'])
export class PersonContactLinkEntity {
  @PrimaryColumn({ name: 'person_id' })
  personId!: string;

  @PrimaryColumn({ name: 'contact_id' })
  contactId!: string;

  @ManyToOne(() => PersonEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'person_id' })
  person!: PersonEntity;

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
