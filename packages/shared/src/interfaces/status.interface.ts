export interface IStatus {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  color?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
