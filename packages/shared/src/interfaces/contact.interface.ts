import { ContactType } from '../enums';

export interface IContact {
  id: string;
  value: string;
  type: ContactType;
  isPrimary?: boolean | null;
  createdAt: Date;
  updatedAt: Date;
}
