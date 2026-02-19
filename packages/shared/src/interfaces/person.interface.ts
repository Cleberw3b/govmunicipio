import { Gender } from '../enums';

export interface IPerson {
  id: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  addressId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPersonIdentification {
  id: string;
  personId: string;
  cpf: string;
  rg?: string | null;
  susCardNumber?: string | null;
  dateOfBirth: Date;
  issuingAuthority?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
