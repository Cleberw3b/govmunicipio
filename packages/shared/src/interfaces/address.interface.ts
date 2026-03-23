export interface IAddress {
  id: string;
  street?: string | null;
  number?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  complement?: string | null;
  country?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
