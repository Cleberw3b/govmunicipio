import { IPermission } from './permission.interface';

export interface IRole {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  permissions?: IPermission[];
}

export interface IRoleListItem {
  id: string;
  name: string;
  code: string;
}
