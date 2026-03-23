import { IPerson } from './person.interface';
import { ISpecialty } from './specialty.interface';

export interface IDoctor {
  id: string;
  personId: string;
  crm: string;
  federalCouncilId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  person?: IPerson;
  specialties?: ISpecialty[];
}

export interface IDoctorListItem {
  id: string;
  crm: string;
  person?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  specialties?: ISpecialty[];
}
