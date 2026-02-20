import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Gender } from '@govmunicipio/shared';
import {
  AddressEntity,
  OrganizationEntity,
  MunicipalityEntity,
  PersonEntity,
  PersonIdentificationEntity,
  PrincipalEntity,
  RoleEntity,
} from '../entities';
import { CreateMunicipalityDto } from './dto/create-municipality.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,

    @InjectRepository(MunicipalityEntity)
    private readonly municipalityRepository: Repository<MunicipalityEntity>,

    @InjectRepository(PrincipalEntity)
    private readonly principalRepository: Repository<PrincipalEntity>,

    @InjectRepository(RoleEntity)
    private readonly roleRepository: Repository<RoleEntity>,
  ) {}

  async findAllMunicipalities(): Promise<MunicipalityEntity[]> {
    return this.municipalityRepository.find({
      relations: { organization: { address: true } },
      order: { createdAt: 'DESC' },
    });
  }

  async findMunicipalityById(id: string): Promise<MunicipalityEntity> {
    const municipality = await this.municipalityRepository.findOne({
      where: { id },
      relations: { organization: { address: true, contacts: true } },
    });
    if (!municipality) {
      throw new NotFoundException(`Municipality ${id} not found`);
    }
    return municipality;
  }

  async findAllUsers(): Promise<PrincipalEntity[]> {
    return this.principalRepository.find({
      relations: { roles: true, organizations: true, person: true },
      order: { createdAt: 'DESC' },
    });
  }

  async createMunicipalityWithAdmin(
    dto: CreateMunicipalityDto,
  ): Promise<MunicipalityEntity> {
    // Check for conflicts before starting transaction
    const existingOrg = await this.dataSource
      .getRepository(OrganizationEntity)
      .findOne({ where: { cnpj: dto.municipality.cnpj } });
    if (existingOrg) {
      throw new ConflictException(
        `Organization with CNPJ ${dto.municipality.cnpj} already exists`,
      );
    }

    const existingPrincipal = await this.principalRepository.findOne({
      where: { username: dto.admin.username },
    });
    if (existingPrincipal) {
      throw new ConflictException(
        `Username ${dto.admin.username} already exists`,
      );
    }

    const adminRole = await this.roleRepository.findOne({
      where: { name: 'admin_municipality' },
    });
    if (!adminRole) {
      throw new NotFoundException('Role admin_municipality not found in DB');
    }

    const passwordHash = await bcrypt.hash(dto.admin.password, 10);

    return this.dataSource.transaction(async (manager) => {
      // 1. Address
      const address = await manager.save(
        manager.create(AddressEntity, {
          street: dto.municipality.street,
          number: dto.municipality.number,
          neighborhood: dto.municipality.neighborhood,
          city: dto.municipality.city,
          state: dto.municipality.state,
          zipCode: dto.municipality.zipCode,
        }),
      );

      // 2. Organization
      const organization = await manager.save(
        manager.create(OrganizationEntity, {
          name: dto.municipality.name,
          cnpj: dto.municipality.cnpj,
          isActive: true,
          address,
        }),
      );

      // 3. Municipality
      const municipality = await manager.save(
        manager.create(MunicipalityEntity, {
          ibgeCode: dto.municipality.ibgeCode,
          state: dto.municipality.state,
          organization,
        }),
      );

      // 4. Person
      const person = await manager.save(
        manager.create(PersonEntity, {
          firstName: dto.admin.firstName,
          lastName: dto.admin.lastName,
          gender: Gender.NOT_INFORMED,
        }),
      );

      // 5. PersonIdentification
      await manager.save(
        manager.create(PersonIdentificationEntity, {
          cpf: dto.admin.cpf,
          dateOfBirth: '1990-01-01' as unknown as Date,
          person,
        }),
      );

      // 6. Principal
      const principal = manager.create(PrincipalEntity, {
        username: dto.admin.username,
        passwordHash,
        isActive: true,
        person,
        organization,
      });
      principal.roles = [adminRole];
      principal.organizations = [organization];
      await manager.save(principal);

      return municipality;
    });
  }
}
