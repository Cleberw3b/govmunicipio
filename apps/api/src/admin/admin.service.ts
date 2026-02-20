import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
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
import { UpdateMunicipalityDto } from './dto/update-municipality.dto';
import { UpdateUserDto } from './dto/update-user.dto';

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

  async updateUser(id: string, dto: UpdateUserDto): Promise<PrincipalEntity> {
    const principal = await this.principalRepository.findOne({
      where: { id },
      relations: { person: { identification: true }, roles: true },
    });
    if (!principal) throw new NotFoundException(`User ${id} not found`);

    await this.dataSource.transaction(async (manager) => {
      const personUpdates: Partial<PersonEntity> = {};
      if (dto.firstName !== undefined) personUpdates.firstName = dto.firstName;
      if (dto.lastName !== undefined) personUpdates.lastName = dto.lastName;
      if (Object.keys(personUpdates).length > 0) {
        await manager.update(PersonEntity, { id: principal.person!.id }, personUpdates);
      }

      if (dto.cpf !== undefined && principal.person?.identification) {
        await manager.update(
          PersonIdentificationEntity,
          { id: principal.person.identification.id },
          { cpf: dto.cpf },
        );
      }

      const principalUpdates: Partial<PrincipalEntity> = {};
      if (dto.username !== undefined) principalUpdates.username = dto.username;
      if (dto.isActive !== undefined) principalUpdates.isActive = dto.isActive;
      if (dto.password) principalUpdates.passwordHash = await bcrypt.hash(dto.password, 10);
      if (Object.keys(principalUpdates).length > 0) {
        await manager.update(PrincipalEntity, { id }, principalUpdates);
      }

      if (dto.roles !== undefined) {
        const roleEntities = await this.roleRepository.findBy(
          dto.roles.map((name) => ({ name })),
        );
        const p = await manager.findOne(PrincipalEntity, {
          where: { id },
          relations: { roles: true },
        });
        p!.roles = roleEntities;
        await manager.save(p!);
      }
    });

    return this.principalRepository.findOne({
      where: { id },
      relations: { roles: true, organizations: true, person: true },
    }) as Promise<PrincipalEntity>;
  }

  async updateMunicipality(
    id: string,
    dto: UpdateMunicipalityDto,
  ): Promise<MunicipalityEntity> {
    const municipality = await this.findMunicipalityById(id);

    if (dto.cnpj !== undefined) {
      const conflict = await this.dataSource
        .getRepository(OrganizationEntity)
        .findOne({ where: { cnpj: dto.cnpj } });
      if (conflict && conflict.id !== municipality.organization.id) {
        throw new ConflictException(
          `Organization with CNPJ ${dto.cnpj} already exists`,
        );
      }
    }

    if (dto.ibgeCode !== undefined) {
      const conflict = await this.municipalityRepository.findOne({
        where: { ibgeCode: dto.ibgeCode },
      });
      if (conflict && conflict.id !== id) {
        throw new ConflictException(
          `Municipality with IBGE code ${dto.ibgeCode} already exists`,
        );
      }
    }

    await this.dataSource.transaction(async (manager) => {
      const addressFields = [
        'street',
        'number',
        'neighborhood',
        'city',
        'state',
        'zipCode',
      ] as const;
      const hasAddressUpdates = addressFields.some(
        (f) => dto[f] !== undefined,
      );

      if (hasAddressUpdates) {
        if (!municipality.organization.address) {
          throw new BadRequestException(
            'Municipality has no address to update',
          );
        }
        const addressUpdates: Partial<AddressEntity> = {};
        if (dto.street !== undefined) addressUpdates.street = dto.street;
        if (dto.number !== undefined) addressUpdates.number = dto.number;
        if (dto.neighborhood !== undefined) addressUpdates.neighborhood = dto.neighborhood;
        if (dto.city !== undefined) addressUpdates.city = dto.city;
        if (dto.state !== undefined) addressUpdates.state = dto.state;
        if (dto.zipCode !== undefined) addressUpdates.zipCode = dto.zipCode;
        await manager.update(
          AddressEntity,
          { id: municipality.organization.address.id },
          addressUpdates,
        );
      }

      const orgUpdates: Partial<OrganizationEntity> = {};
      if (dto.name !== undefined) orgUpdates.name = dto.name;
      if (dto.cnpj !== undefined) orgUpdates.cnpj = dto.cnpj;
      if (dto.isActive !== undefined) orgUpdates.isActive = dto.isActive;
      if (Object.keys(orgUpdates).length > 0) {
        await manager.update(
          OrganizationEntity,
          { id: municipality.organization.id },
          orgUpdates,
        );
      }

      const mUpdates: Partial<MunicipalityEntity> = {};
      if (dto.ibgeCode !== undefined) mUpdates.ibgeCode = dto.ibgeCode;
      if (dto.state !== undefined) mUpdates.state = dto.state;
      if (Object.keys(mUpdates).length > 0) {
        await manager.update(MunicipalityEntity, { id }, mUpdates);
      }
    });

    return this.findMunicipalityById(id);
  }
}
