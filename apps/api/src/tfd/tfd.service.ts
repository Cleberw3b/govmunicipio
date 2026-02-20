import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TfdRequestEntity, StatusEntity, MunicipalityEntity } from '../entities';
import { OrganizationService } from '../organization/organization.service';
import { CreateTfdRequestDto } from './dto/create-tfd-request.dto';

interface TfdStats {
  total: number;
  pending: number;
  approved: number;
  thisMonth: number;
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
      diagnosisCid: dto.diagnosisCid,
      procedureDescription: dto.procedureDescription,
      justification: dto.justification,
      requestDate: dto.requestDate as unknown as Date,
      travelDate: dto.travelDate
        ? (dto.travelDate as unknown as Date)
        : null,
      returnDate: dto.returnDate
        ? (dto.returnDate as unknown as Date)
        : null,
      transportType: dto.transportType,
      estimatedCost: dto.estimatedCost ?? null,
      notes: dto.notes ?? null,
      patientPerson: { id: dto.patientPersonId },
      companionPerson: dto.companionPersonId
        ? { id: dto.companionPersonId }
        : null,
      requestingDoctor: { id: dto.requestingDoctorId },
      destinationHospital: { id: dto.destinationHospitalId },
      hotel: dto.hotelId ? { id: dto.hotelId } : null,
      municipality: { id: municipality.id },
      createdByPrincipal: { id: principalId },
      status: { id: defaultStatus.id },
    });

    const saved = await this.tfdRequestRepository.save(tfdRequest);

    return this.tfdRequestRepository.findOneOrFail({
      where: { id: saved.id },
      relations: {
        patientPerson: { identification: true },
        companionPerson: true,
        requestingDoctor: { person: true },
        destinationHospital: { organization: true },
        hotel: true,
        municipality: true,
        status: true,
      },
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
      relations: {
        patientPerson: { identification: true },
        companionPerson: true,
        requestingDoctor: { person: true },
        destinationHospital: { organization: true },
        hotel: true,
        municipality: true,
        status: true,
      },
    });

    if (!tfdRequest) {
      throw new NotFoundException(`TFD request with id ${id} not found`);
    }

    return tfdRequest;
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

    return { total, pending, approved, thisMonth };
  }
}
