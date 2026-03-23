import {
  Entity,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { MunicipalityEntity } from './municipality.entity';
import { HotelEntity } from './hotel.entity';

@Entity('municipality_hotel')
export class MunicipalityHotelLinkEntity {
  @PrimaryColumn({ name: 'municipality_id' })
  municipalityId!: string;

  @PrimaryColumn({ name: 'hotel_id' })
  hotelId!: string;

  @ManyToOne(() => MunicipalityEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'municipality_id' })
  municipality!: MunicipalityEntity;

  @ManyToOne(() => HotelEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'hotel_id' })
  hotel!: HotelEntity;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt?: Date | null;
}
