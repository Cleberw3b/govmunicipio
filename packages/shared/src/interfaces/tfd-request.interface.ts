import { TransportType } from '../enums';

export interface ITfdRequest {
  id: string;
  protocolNumber: string;
  patientPersonId: string;
  companionPersonId?: string | null;
  requestingDoctorId: string;
  destinationHospitalId: string;
  hotelId?: string | null;
  municipalityId: string;
  createdByPrincipalId: string;
  statusId: string;
  diagnosisCid: string;
  procedureDescription: string;
  justification: string;
  requestDate: Date;
  travelDate?: Date | null;
  returnDate?: Date | null;
  transportType: TransportType;
  estimatedCost?: number | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
