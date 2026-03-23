export interface IPermission {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
