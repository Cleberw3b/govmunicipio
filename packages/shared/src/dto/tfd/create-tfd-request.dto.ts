import { TransportType } from '../../enums';

export interface CreateTfdRequestDto {
  patientPersonId: string;
  companionPersonId?: string | null;
  requestingDoctorId: string;
  destinationHospitalId: string;
  hotelId?: string | null;
  diagnosisCid: string;
  procedureDescription: string;
  justification: string;
  requestDate: string;
  travelDate?: string | null;
  returnDate?: string | null;
  transportType: TransportType;
  estimatedCost?: number | null;
  notes?: string | null;
}
