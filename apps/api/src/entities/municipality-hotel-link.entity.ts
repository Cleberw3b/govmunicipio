import { Entity, PrimaryColumn } from 'typeorm';

@Entity('municipality_hotel')
export class MunicipalityHotelLinkEntity {
  @PrimaryColumn({ name: 'municipality_id' })
  municipalityId!: string;

  @PrimaryColumn({ name: 'hotel_id' })
  hotelId!: string;
}
