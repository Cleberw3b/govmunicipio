import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  OrganizationEntity,
  HospitalEntity,
  HotelEntity,
  DoctorEntity,
  SpecialtyEntity,
  MunicipalityEntity,
} from '../entities';

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

  async findSpecialties(): Promise<SpecialtyEntity[]> {
    return this.specialtyRepository.find({
      where: { isActive: true },
    });
  }

  async findMunicipalityByOrganizationId(
    organizationId: string,
  ): Promise<MunicipalityEntity> {
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
