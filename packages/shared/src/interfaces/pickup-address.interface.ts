export interface IPickupAddress {
  id: string;
  tfdRequestId: string;
  description: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  complement?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
