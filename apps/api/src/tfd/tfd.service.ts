import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TfdRequestEntity, StatusEntity, MunicipalityEntity } from '../entities';
import { OrganizationService } from '../organization/organization.service';
import { CreateTfdRequestDto } from './dto/create-tfd-request.dto';
import { UpdateTfdRequestDto } from './dto/update-tfd-request.dto';
import { UpdateTfdCostsDto } from './dto/update-tfd-costs.dto';
import { WhatsAppService } from './whatsapp.service';

interface TfdStats {
  total: number;
  pending: number;
  approved: number;
  thisMonth: number;
  monthlySpending: number;
  averagePerPatient: number;
}

@Injectable()
export class TfdService {
  constructor(
    @InjectRepository(TfdRequestEntity)
    private readonly tfdRequestRepository: Repository<TfdRequestEntity>,
    @InjectRepository(StatusEntity)
    private readonly statusRepository: Repository<StatusEntity>,
    @InjectRepository(MunicipalityEntity)
    private readonly municipalityRepository: Repository<MunicipalityEntity>,
    private readonly organizationService: OrganizationService,
    private readonly whatsAppService: WhatsAppService,
  ) {}

  private generateProtocolNumber(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const random = String(Math.floor(Math.random() * 1_000_000)).padStart(
      6,
      '0',
    );
    return `TFD-${year}${month}${day}-${random}`;
  }

  private getRelations() {
    return {
      patientPerson: { identification: true, contacts: true },
      companionPerson: true,
      requestingDoctor: { person: true },
      destinationHospital: { organization: { address: true }, specialties: true },
      specialty: true,
      hotel: true,
      pickupAddress: true,
      returnPickupAddress: true,
      municipality: true,
      status: true,
    };
  }

  async create(
    dto: CreateTfdRequestDto,
    principalId: string,
    organizationId: string,
  ): Promise<TfdRequestEntity> {
    const municipality =
      await this.organizationService.findMunicipalityByOrganizationId(
        organizationId,
      );

    const defaultStatus = await this.statusRepository.findOne({
      where: { code: 'draft' },
    });

    if (!defaultStatus) {
      throw new NotFoundException('Default status (draft) not found');
    }

    const protocolNumber = this.generateProtocolNumber();

    const tfdRequest = this.tfdRequestRepository.create({
      protocolNumber,
      diagnosisCid: dto.diagnosisCid ?? null,
      procedureDescription: dto.procedureDescription ?? null,
      justification: dto.justification ?? null,
      requestDate: dto.requestDate ? (dto.requestDate as unknown as Date) : null,
      travelDate: dto.travelDate ? (dto.travelDate as unknown as Date) : null,
      returnDate: dto.returnDate ? (dto.returnDate as unknown as Date) : null,
      transportType: dto.transportType ?? null,
      estimatedCost: dto.estimatedCost ?? null,
      transportationCost: dto.transportationCost ?? null,
      foodCost: dto.foodCost ?? null,
      hotelCost: dto.hotelCost ?? null,
      notes: dto.notes ?? null,
      patientPerson: { id: dto.patientPersonId },
      companionPerson: dto.companionPersonId ? { id: dto.companionPersonId } : null,
      ...(dto.requestingDoctorId ? { requestingDoctor: { id: dto.requestingDoctorId } } : {}),
      ...(dto.destinationHospitalId ? { destinationHospital: { id: dto.destinationHospitalId } } : {}),
      hotel: dto.hotelId ? { id: dto.hotelId } : null,
      municipality: { id: municipality.id },
      createdByPrincipal: { id: principalId },
      status: { id: defaultStatus.id },
    });

    const saved = await this.tfdRequestRepository.save(tfdRequest);

    return this.tfdRequestRepository.findOneOrFail({
      where: { id: saved.id },
      relations: this.getRelations(),
    });
  }

  async findAll(
    organizationId: string,
    statusFilter?: string,
  ): Promise<TfdRequestEntity[]> {
    const municipality =
      await this.organizationService.findMunicipalityByOrganizationId(
        organizationId,
      );

    const queryBuilder = this.tfdRequestRepository
      .createQueryBuilder('tfd')
      .leftJoinAndSelect('tfd.patientPerson', 'patientPerson')
      .leftJoinAndSelect('patientPerson.identification', 'patientIdentification')
      .leftJoinAndSelect('tfd.companionPerson', 'companionPerson')
      .leftJoinAndSelect('tfd.requestingDoctor', 'requestingDoctor')
      .leftJoinAndSelect('requestingDoctor.person', 'doctorPerson')
      .leftJoinAndSelect('tfd.destinationHospital', 'destinationHospital')
      .leftJoinAndSelect('destinationHospital.organization', 'hospitalOrganization')
      .leftJoinAndSelect('tfd.hotel', 'hotel')
      .leftJoinAndSelect('tfd.status', 'status')
      .where('tfd.municipality_id = :municipalityId', {
        municipalityId: municipality.id,
      })
      .orderBy('tfd.created_at', 'DESC');

    if (statusFilter) {
      queryBuilder.andWhere('status.code = :statusCode', {
        statusCode: statusFilter,
      });
    }

    return queryBuilder.getMany();
  }

  async findOne(
    id: string,
    organizationId: string,
  ): Promise<TfdRequestEntity> {
    const municipality =
      await this.organizationService.findMunicipalityByOrganizationId(
        organizationId,
      );

    const tfdRequest = await this.tfdRequestRepository.findOne({
      where: { id, municipality: { id: municipality.id } },
      relations: this.getRelations(),
    });

    if (!tfdRequest) {
      throw new NotFoundException(`TFD request with id ${id} not found`);
    }

    return tfdRequest;
  }

  async updateDraft(
    id: string,
    dto: UpdateTfdRequestDto,
    organizationId: string,
  ): Promise<TfdRequestEntity> {
    const tfdRequest = await this.findOne(id, organizationId);

    if (dto.companionPersonId !== undefined) {
      tfdRequest.companionPerson = dto.companionPersonId
        ? ({ id: dto.companionPersonId } as any)
        : null;
    }
    if (dto.requestingDoctorId !== undefined) {
      tfdRequest.requestingDoctor = { id: dto.requestingDoctorId } as any;
    }
    if (dto.destinationHospitalId !== undefined) {
      tfdRequest.destinationHospital = { id: dto.destinationHospitalId } as any;
    }
    if (dto.specialtyId !== undefined) {
      tfdRequest.specialty = dto.specialtyId ? ({ id: dto.specialtyId } as any) : null;
    }
    if (dto.hotelId !== undefined) {
      tfdRequest.hotel = dto.hotelId ? ({ id: dto.hotelId } as any) : null;
    }
    if (dto.pickupAddressId !== undefined) {
      tfdRequest.pickupAddress = dto.pickupAddressId ? ({ id: dto.pickupAddressId } as any) : null;
    }
    if (dto.returnPickupAddressId !== undefined) {
      tfdRequest.returnPickupAddress = dto.returnPickupAddressId ? ({ id: dto.returnPickupAddressId } as any) : null;
    }
    if (dto.departureCustomAddress !== undefined) tfdRequest.departureCustomAddress = dto.departureCustomAddress ?? null;
    if (dto.diagnosisCid !== undefined) tfdRequest.diagnosisCid = dto.diagnosisCid;
    if (dto.procedureDescription !== undefined) tfdRequest.procedureDescription = dto.procedureDescription;
    if (dto.justification !== undefined) tfdRequest.justification = dto.justification;
    if (dto.requestDate !== undefined) {
      tfdRequest.requestDate = dto.requestDate as unknown as Date;
    }
    if (dto.travelDate !== undefined) {
      tfdRequest.travelDate = dto.travelDate ? (dto.travelDate as unknown as Date) : null;
    }
    if (dto.returnDate !== undefined) {
      tfdRequest.returnDate = dto.returnDate ? (dto.returnDate as unknown as Date) : null;
    }
    if (dto.transportType !== undefined) tfdRequest.transportType = dto.transportType;
    if (dto.estimatedCost !== undefined) tfdRequest.estimatedCost = dto.estimatedCost ?? null;
    if (dto.transportationCost !== undefined) tfdRequest.transportationCost = dto.transportationCost ?? null;
    if (dto.foodCost !== undefined) tfdRequest.foodCost = dto.foodCost ?? null;
    if (dto.hotelCost !== undefined) tfdRequest.hotelCost = dto.hotelCost ?? null;
    if (dto.notes !== undefined) tfdRequest.notes = dto.notes ?? null;

    await this.tfdRequestRepository.save(tfdRequest);
    return this.findOne(id, organizationId);
  }

  async submit(
    id: string,
    organizationId: string,
  ): Promise<TfdRequestEntity> {
    const tfdRequest = await this.findOne(id, organizationId);

    if (
      !tfdRequest.requestingDoctor ||
      !tfdRequest.destinationHospital ||
      !tfdRequest.diagnosisCid ||
      !tfdRequest.procedureDescription ||
      !tfdRequest.justification ||
      !tfdRequest.requestDate ||
      !tfdRequest.transportType
    ) {
      throw new BadRequestException(
        'Todos os campos obrigatórios devem ser preenchidos antes de enviar.',
      );
    }

    const pendingStatus = await this.statusRepository.findOne({
      where: { code: 'pending' },
    });
    if (!pendingStatus) {
      throw new NotFoundException('Status "pending" not found');
    }

    tfdRequest.status = pendingStatus;
    await this.tfdRequestRepository.save(tfdRequest);
    const updated = await this.findOne(id, organizationId);
    this.whatsAppService.sendTfdNotification(updated).catch(() => {}); // fire-and-forget
    return updated;
  }

  async updateStatus(
    id: string,
    statusId: string,
    organizationId: string,
  ): Promise<TfdRequestEntity> {
    const tfdRequest = await this.findOne(id, organizationId);

    const status = await this.statusRepository.findOne({
      where: { id: statusId },
    });

    if (!status) {
      throw new NotFoundException(`Status with id ${statusId} not found`);
    }

    tfdRequest.status = status;

    await this.tfdRequestRepository.save(tfdRequest);

    return this.findOne(id, organizationId);
  }

  async updateCosts(
    id: string,
    dto: UpdateTfdCostsDto,
    organizationId: string,
  ): Promise<TfdRequestEntity> {
    const tfdRequest = await this.findOne(id, organizationId);

    if (dto.transportationCost !== undefined)
      tfdRequest.transportationCost = dto.transportationCost;
    if (dto.foodCost !== undefined) tfdRequest.foodCost = dto.foodCost;
    if (dto.hotelCost !== undefined) tfdRequest.hotelCost = dto.hotelCost;

    await this.tfdRequestRepository.save(tfdRequest);
    return this.findOne(id, organizationId);
  }

  async getStats(organizationId: string): Promise<TfdStats> {
    const municipality =
      await this.organizationService.findMunicipalityByOrganizationId(
        organizationId,
      );

    const municipalityId = municipality.id;

    const total = await this.tfdRequestRepository.count({
      where: { municipality: { id: municipalityId } },
    });

    const pending = await this.tfdRequestRepository.count({
      where: {
        municipality: { id: municipalityId },
        status: { code: 'pending' },
      },
    });

    const approved = await this.tfdRequestRepository.count({
      where: {
        municipality: { id: municipalityId },
        status: { code: 'approved' },
      },
    });

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const thisMonth = await this.tfdRequestRepository
      .createQueryBuilder('tfd')
      .where('tfd.municipality_id = :municipalityId', { municipalityId })
      .andWhere('tfd.created_at >= :firstDayOfMonth', { firstDayOfMonth })
      .getCount();

    const spendingResult = await this.tfdRequestRepository
      .createQueryBuilder('tfd')
      .select(
        'COALESCE(SUM(COALESCE(tfd.transportation_cost, 0) + COALESCE(tfd.food_cost, 0) + COALESCE(tfd.hotel_cost, 0)), 0)',
        'total',
      )
      .where('tfd.municipality_id = :municipalityId', { municipalityId })
      .andWhere('tfd.created_at >= :firstDayOfMonth', { firstDayOfMonth })
      .getRawOne<{ total: string }>();

    const monthlySpending = parseFloat(spendingResult?.total ?? '0');
    const averagePerPatient =
      thisMonth > 0 ? monthlySpending / thisMonth : 0;

    return { total, pending, approved, thisMonth, monthlySpending, averagePerPatient };
  }
}
