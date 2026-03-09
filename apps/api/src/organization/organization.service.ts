import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, ILike, Repository } from 'typeorm';
import {
  OrganizationEntity,
  HospitalEntity,
  HotelEntity,
  DoctorEntity,
  SpecialtyEntity,
  MunicipalityEntity,
  PersonEntity,
  PersonIdentificationEntity,
} from '../entities';
import { CreateDoctorDto } from './dto/create-doctor.dto';

@Injectable()
export class OrganizationService {
  constructor(
    @InjectRepository(OrganizationEntity)
    private readonly organizationRepository: Repository<OrganizationEntity>,
    @InjectRepository(HospitalEntity)
    private readonly hospitalRepository: Repository<HospitalEntity>,
    @InjectRepository(HotelEntity)
    private readonly hotelRepository: Repository<HotelEntity>,
    @InjectRepository(DoctorEntity)
    private readonly doctorRepository: Repository<DoctorEntity>,
    @InjectRepository(SpecialtyEntity)
    private readonly specialtyRepository: Repository<SpecialtyEntity>,
    @InjectRepository(MunicipalityEntity)
    private readonly municipalityRepository: Repository<MunicipalityEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async findHospitals(): Promise<HospitalEntity[]> {
    return this.hospitalRepository.find({
      relations: {
        organization: {
          address: true,
          contacts: true,
        },
        specialties: true,
      },
    });
  }

  async findDoctors(): Promise<DoctorEntity[]> {
    return this.doctorRepository.find({
      relations: {
        person: {
          identification: true,
        },
        specialties: true,
      },
    });
  }

  async searchDoctors(q: string): Promise<DoctorEntity[]> {
    const term = q.trim();
    const relations = { person: { identification: true }, specialties: true };
    const [byCrm, byFirstName, byLastName] = await Promise.all([
      this.doctorRepository.find({ where: { crm: ILike(`%${term}%`) }, relations }),
      this.doctorRepository.find({ where: { person: { firstName: ILike(`%${term}%`) } }, relations }),
      this.doctorRepository.find({ where: { person: { lastName: ILike(`%${term}%`) } }, relations }),
    ]);
    const seen = new Set<string>();
    const results: DoctorEntity[] = [];
    for (const d of [...byCrm, ...byFirstName, ...byLastName]) {
      if (!seen.has(d.id)) { seen.add(d.id); results.push(d); }
    }
    return results;
  }

  async createDoctor(dto: CreateDoctorDto): Promise<DoctorEntity> {
    return this.dataSource.transaction(async (manager) => {
      const person = await manager.save(PersonEntity, manager.create(PersonEntity, {
        firstName: dto.firstName,
        lastName: dto.lastName,
        gender: dto.gender,
      }));

      await manager.save(PersonIdentificationEntity, manager.create(PersonIdentificationEntity, {
        cpf: dto.cpf,
        dateOfBirth: dto.dateOfBirth as unknown as Date,
        person,
      }));

      const specialties = dto.specialtyIds?.length
        ? await this.specialtyRepository.findByIds(dto.specialtyIds)
        : [];

      const doctor = manager.create(DoctorEntity, { crm: dto.crm, isActive: true, person });
      doctor.specialties = specialties;
      const saved = await manager.save(DoctorEntity, doctor);

      return manager.findOneOrFail(DoctorEntity, {
        where: { id: saved.id },
        relations: { person: { identification: true }, specialties: true },
      });
    });
  }

  async findSpecialties(): Promise<SpecialtyEntity[]> {
    return this.specialtyRepository.find({
      where: { isActive: true },
    });
  }

  async findMunicipalityByOrganizationId(
    organizationId: string,
  ): Promise<MunicipalityEntity> {
    if (!organizationId) {
      throw new NotFoundException('Municipality not found: no organization in token');
    }

    const municipality = await this.municipalityRepository.findOne({
      where: { organization: { id: organizationId } },
      relations: { organization: true },
    });

    if (!municipality) {
      throw new NotFoundException(
        `Municipality not found for organization ${organizationId}`,
      );
    }

    return municipality;
  }
}
