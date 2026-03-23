import { IOrganization } from './organization.interface';
import { ISpecialty } from './specialty.interface';

export interface IHospital {
  id: string;
  organizationId: string;
  cnesCode: string;
  createdAt: Date;
  updatedAt: Date;
  organization?: IOrganization;
  specialties?: ISpecialty[];
}

export interface IHospitalListItem {
  id: string;
  cnesCode: string;
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
