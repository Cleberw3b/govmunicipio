import { IOrganization } from './organization.interface';

export interface IMunicipalityBase {
  id: string;
  ibgeCode: string;
  state: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMunicipality extends IMunicipalityBase {
  organization?: IOrganization;
}

export interface IMunicipalityListItem {
  id: string;
  ibgeCode: string;
  state: string;
  organization: {
    id: string;
    name: string;
    cnpj: string;
    isActive: boolean;
    address: {
      city: string;
      state: string;
      street: string;
      number: string;
      neighborhood: string;
      zipCode: string;
    } | null;
  };
}
