import { IAddress } from './address.interface';

export interface IOrganization {
  id: string;
  name: string;
  cnpj: string;
  addressId?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  address?: IAddress | null;
}
