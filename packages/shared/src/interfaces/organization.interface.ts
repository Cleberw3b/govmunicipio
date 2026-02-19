export interface IOrganization {
  id: string;
  name: string;
  cnpj: string;
  addressId?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMunicipality {
  id: string;
  organizationId: string;
  ibgeCode: string;
  state: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IHospital {
  id: string;
  organizationId: string;
  cnesCode: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IHotel {
  id: string;
  organizationId: string;
  municipalityId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
