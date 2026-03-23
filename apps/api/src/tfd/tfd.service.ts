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
import { paginate } from '../common';
import { IPaginatedResponse } from '@govmunicipio/shared';

interface TfdStats {
  total: number;
  pending: number;
  inTransit: number;
  thisMonth: number;
  monthlySpending: number;
  averagePerPatient: number;
}

@Injectable()
export class TfdService {
  /**
   * State machine: defines which status codes each status can transition to
   * via the updateStatus() endpoint.
   * Note: draft → pending is handled by submit(), not updateStatus().
   */
  private static readonly VALID_TRANSITIONS: Record<string, string[]> = {
    draft: ['cancelled'],
    pending: ['in_transit', 'cancelled'],
    in_transit: ['finalized', 'cancelled'],
    finalized: [],
    cancelled: [],
  };

  /**
   * Fields that can be edited when status is 'pending'.
   * All other fields are locked after submission.
   */
  private static readonly PENDING_EDITABLE_FIELDS: Set<string> = new Set([
    'travelDate',
    'returnDate',
    'pickupAddressId',
    'returnPickupAddressId',
    'departureCustomAddress',
    'transportationCost',
    'foodCost',
    'hotelCost',
    'notes',
  ]);

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
      patientPerson: { identification: true, contactLinks: { contact: true } },
      companionPerson: true,
      requestingDoctor: { person: true },
      destinationHospital: { organization: { addressLinks: { address: true } }, specialtyLinks: { specialty: true } },
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
    page: number = 1,
    limit: number = 20,
  ): Promise<IPaginatedResponse<TfdRequestEntity>> {
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
      .orderBy('tfd.createdAt', 'DESC');

    if (statusFilter) {
      queryBuilder.andWhere('status.code = :statusCode', {
        statusCode: statusFilter,
      });
    }

    return paginate(queryBuilder, page, limit);
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

  async updateRequest(
    id: string,
    dto: UpdateTfdRequestDto,
    organizationId: string,
  ): Promise<TfdRequestEntity> {
    const tfdRequest = await this.findOne(id, organizationId);
    const currentStatus = tfdRequest.status?.code;

    // Only draft and pending can be edited
    if (currentStatus !== 'draft' && currentStatus !== 'pending') {
      throw new BadRequestException(
        'Solicitação não pode ser editada neste status.',
      );
    }

    // For pending status, restrict which fields can be changed
    if (currentStatus === 'pending') {
      const dtoKeys = Object.keys(dto).filter(
        (key) => (dto as any)[key] !== undefined,
      );
      const blockedFields = dtoKeys.filter(
        (key) => !TfdService.PENDING_EDITABLE_FIELDS.has(key),
      );
      if (blockedFields.length > 0) {
        throw new BadRequestException(
          `Os seguintes campos não podem ser alterados após o envio: ${blockedFields.join(', ')}`,
        );
      }
    }

    // Apply updates (same logic as before)
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

    if (tfdRequest.status?.code !== 'draft') {
      throw new BadRequestException(
        'Apenas solicitações em rascunho podem ser enviadas.',
      );
    }

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
    statusCode: string,
    organizationId: string,
  ): Promise<TfdRequestEntity> {
    const tfdRequest = await this.findOne(id, organizationId);
    const currentCode = tfdRequest.status?.code;

    if (!currentCode) {
      throw new BadRequestException('Solicitação sem status atual.');
    }

    // Validate transition
    const allowedTransitions = TfdService.VALID_TRANSITIONS[currentCode];
    if (!allowedTransitions || !allowedTransitions.includes(statusCode)) {
      throw new BadRequestException(
        `Transição de status inválida: não é possível alterar de "${currentCode}" para "${statusCode}".`,
      );
    }

    const status = await this.statusRepository.findOne({
      where: { code: statusCode },
    });

    if (!status) {
      throw new NotFoundException(`Status "${statusCode}" not found`);
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

    const inTransit = await this.tfdRequestRepository.count({
      where: {
        municipality: { id: municipalityId },
        status: { code: 'in_transit' },
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

    return { total, pending, inTransit, thisMonth, monthlySpending, averagePerPatient };
  }

  async findStatuses(): Promise<StatusEntity[]> {
    return this.statusRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC' },
    });
  }
}
