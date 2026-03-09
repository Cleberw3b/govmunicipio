import { TransportType } from '../../enums';

export interface CreateTfdRequestDto {
  patientPersonId: string;
  companionPersonId?: string | null;
  requestingDoctorId?: string | null;
  destinationHospitalId?: string | null;
  hotelId?: string | null;
  diagnosisCid?: string | null;
  procedureDescription?: string | null;
  justification?: string | null;
  requestDate?: string | null;
  travelDate?: string | null;
  returnDate?: string | null;
  transportType?: TransportType | null;
  estimatedCost?: number | null;
  transportationCost?: number | null;
  foodCost?: number | null;
  hotelCost?: number | null;
  notes?: string | null;
}
