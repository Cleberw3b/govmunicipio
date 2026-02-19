export interface IPrincipal {
  id: string;
  username: string;
  isActive: boolean;
  personId?: string | null;
  organizationId?: string | null;
  lastLogin?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
