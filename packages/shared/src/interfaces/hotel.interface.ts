import { IOrganization } from './organization.interface';

export interface IHotel {
  id: string;
  organizationId: string;
  municipalityId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  organization?: IOrganization;
}

export interface IHotelListItem {
  id: string;
  organization: {
    id: string;
    name: string;
    cnpj: string;
    isActive: boolean;
    address: {
      city: string;
      state: string;
      street?: string;
      number?: string;
      neighborhood?: string;
      zipCode?: string;
    } | null;
  };
}
