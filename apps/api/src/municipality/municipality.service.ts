import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Gender } from '@govmunicipio/shared';
import {
  AddressEntity,
  PrincipalEntity,
  PersonEntity,
  PersonIdentificationEntity,
  OrganizationEntity,
  MunicipalityEntity,
  HotelEntity,
  RoleEntity,
} from '../entities';
import { CreateMunicipalityUserDto } from './dto/create-municipality-user.dto';
import { UpdateMunicipalityUserDto } from './dto/update-municipality-user.dto';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { CreateHotelDto } from './dto/create-hotel.dto';
import { UpdateHotelDto } from './dto/update-hotel.dto';

@Injectable()
export class MunicipalityService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(PrincipalEntity)
    private readonly principalRepository: Repository<PrincipalEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepository: Repository<RoleEntity>,
  ) {}

  async findUsers(organizationId: string): Promise<PrincipalEntity[]> {
    return this.principalRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.roles', 'role')
      .leftJoinAndSelect('p.person', 'person')
      .leftJoinAndSelect('person.identification', 'identification')
      .leftJoinAndSelect('p.organizations', 'org')
      .where('org.id = :organizationId', { organizationId })
      .orderBy('p.createdAt', 'DESC')
      .getMany();
  }

  async createUser(
    dto: CreateMunicipalityUserDto,
    organizationId: string,
  ): Promise<PrincipalEntity> {
    const organization = await this.dataSource
      .getRepository(OrganizationEntity)
      .findOne({ where: { id: organizationId } });
    if (!organization) {
      throw new NotFoundException(`Organization not found`);
    }

    const role = await this.roleRepository.findOne({ where: { name: dto.role } });
    if (!role) throw new NotFoundException(`Role ${dto.role} not found`);

    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.dataSource
      .transaction(async (manager) => {
        // C1: Username uniqueness check inside the transaction to prevent race conditions
        const existing = await manager.findOne(PrincipalEntity, {
          where: { username: dto.username },
        });
        if (existing) {
          throw new ConflictException(`Username ${dto.username} already exists`);
        }

        const person = await manager.save(
          manager.create(PersonEntity, {
            firstName: dto.firstName,
            lastName: dto.lastName,
            gender: Gender.NOT_INFORMED,
          }),
        );

        await manager.save(
          manager.create(PersonIdentificationEntity, {
            cpf: dto.cpf,
            dateOfBirth: new Date('1990-01-01'),
            person,
          }),
        );

        // I3: Omit the OneToOne `organization` field; use only the ManyToMany `organizations`
        const principal = manager.create(PrincipalEntity, {
          username: dto.username,
          passwordHash,
          isActive: true,
          person,
        });
        principal.roles = [role];
        principal.organizations = [organization];
        return manager.save(principal);
      })
      .catch((err: unknown) => {
        if (err instanceof ConflictException) throw err;
        if (err instanceof NotFoundException) throw err;
        if (
          typeof err === 'object' &&
          err !== null &&
          'code' in err &&
          (err as { code: string }).code === '23505'
        ) {
          throw new ConflictException(`Username ${dto.username} already exists`);
        }
        throw err;
      });
  }

  async updateUser(
    id: string,
    dto: UpdateMunicipalityUserDto,
    organizationId: string,
  ): Promise<PrincipalEntity> {
    const principal = await this.principalRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.roles', 'role')
      .leftJoinAndSelect('p.person', 'person')
      .leftJoinAndSelect('person.identification', 'identification')
      .leftJoinAndSelect('p.organizations', 'org')
      .where('p.id = :id', { id })
      .getOne();

    if (!principal) throw new NotFoundException(`User ${id} not found`);

    const belongsToOrg = principal.organizations.some((o) => o.id === organizationId);
    if (!belongsToOrg) {
      throw new ForbiddenException('User does not belong to your organization');
    }

    if (!principal.person) {
      throw new BadRequestException(`User ${id} has no associated person record`);
    }
    const person = principal.person;

    await this.dataSource.transaction(async (manager) => {
      const personUpdates: Partial<PersonEntity> = {};
      if (dto.firstName !== undefined) personUpdates.firstName = dto.firstName;
      if (dto.lastName !== undefined) personUpdates.lastName = dto.lastName;
      if (Object.keys(personUpdates).length > 0) {
        await manager.update(PersonEntity, { id: person.id }, personUpdates);
      }

      // I2: Wrap CPF update in try-catch to surface uniqueness violations as ConflictException
      if (dto.cpf !== undefined) {
        if (!person.identification) {
          throw new BadRequestException(`User ${id} has no identification record`);
        }
        try {
          await manager.update(
            PersonIdentificationEntity,
            { id: person.identification.id },
            { cpf: dto.cpf },
          );
        } catch (err: unknown) {
          if (
            typeof err === 'object' &&
            err !== null &&
            'code' in err &&
            (err as { code: string }).code === '23505'
          ) {
            throw new ConflictException(`CPF ${dto.cpf} is already in use`);
          }
          throw err;
        }
      }

      const principalUpdates: Partial<PrincipalEntity> = {};
      if (dto.username !== undefined) principalUpdates.username = dto.username;
      if (dto.isActive !== undefined) principalUpdates.isActive = dto.isActive;
      if (dto.password) principalUpdates.passwordHash = await bcrypt.hash(dto.password, 10);
      if (Object.keys(principalUpdates).length > 0) {
        await manager.update(PrincipalEntity, { id }, principalUpdates);
      }

      if (dto.role !== undefined) {
        const roleEntity = await manager.findOne(RoleEntity, { where: { name: dto.role } });
        if (!roleEntity) throw new NotFoundException(`Role ${dto.role} not found`);
        const p = await manager.findOne(PrincipalEntity, {
          where: { id },
          relations: { roles: true },
        });
        if (!p) throw new NotFoundException(`User ${id} not found`);
        p.roles = [roleEntity];
        await manager.save(p);
      }
    });

    // C2: Await the re-fetch and explicitly check for null instead of casting
    const updated = await this.principalRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.roles', 'role')
      .leftJoinAndSelect('p.person', 'person')
      .leftJoinAndSelect('person.identification', 'identification')
      .leftJoinAndSelect('p.organizations', 'org')
      .where('p.id = :id', { id })
      .getOne();

    if (!updated) throw new NotFoundException(`User ${id} not found after update`);
    return updated;
  }

  async findOrganizations(): Promise<OrganizationEntity[]> {
    return this.dataSource
      .getRepository(OrganizationEntity)
      .createQueryBuilder('org')
      .leftJoin('municipality', 'mun', 'mun.organization_id = org.id')
      .leftJoinAndSelect('org.address', 'address')
      .where('mun.id IS NULL')
      .orderBy('org.name', 'ASC')
      .getMany();
  }

  async createOrganization(dto: CreateOrganizationDto): Promise<OrganizationEntity> {
    const existing = await this.dataSource
      .getRepository(OrganizationEntity)
      .findOne({ where: { cnpj: dto.cnpj } });
    if (existing) {
      throw new ConflictException(`Organization with CNPJ ${dto.cnpj} already exists`);
    }

    const hasAddress = dto.city || dto.state || dto.street || dto.number || dto.neighborhood || dto.zipCode;

    return this.dataSource
      .transaction(async (manager) => {
        let address: AddressEntity | undefined;
        if (hasAddress) {
          address = await manager.save(
            manager.create(AddressEntity, {
              city: dto.city ?? '',
              state: dto.state ?? '',
              street: dto.street,
              number: dto.number,
              neighborhood: dto.neighborhood,
              zipCode: dto.zipCode,
            }),
          );
        }

        return manager.save(
          manager.create(OrganizationEntity, {
            name: dto.name,
            cnpj: dto.cnpj,
            isActive: true,
            ...(address ? { address } : {}),
          }),
        );
      })
      .catch((err: unknown) => {
        if (err instanceof ConflictException) throw err;
        if (
          typeof err === 'object' &&
          err !== null &&
          'code' in err &&
          (err as { code: string }).code === '23505'
        ) {
          throw new ConflictException(`Organization with CNPJ ${dto.cnpj} already exists`);
        }
        throw err;
      });
  }

  private async getMunicipalityByOrganizationId(organizationId: string): Promise<MunicipalityEntity> {
    const municipality = await this.dataSource
      .getRepository(MunicipalityEntity)
      .findOne({ where: { organization: { id: organizationId } } });
    if (!municipality) throw new NotFoundException('Municipality not found for this organization');
    return municipality;
  }

  async findHotels(organizationId: string): Promise<HotelEntity[]> {
    const municipality = await this.getMunicipalityByOrganizationId(organizationId);
    return this.dataSource
      .getRepository(HotelEntity)
      .find({
        where: { municipality: { id: municipality.id } },
        relations: { organization: { address: true } },
        order: { createdAt: 'DESC' },
      });
  }

  async createHotel(dto: CreateHotelDto, organizationId: string): Promise<HotelEntity> {
    const municipality = await this.getMunicipalityByOrganizationId(organizationId);

    const existingOrg = await this.dataSource
      .getRepository(OrganizationEntity)
      .findOne({ where: { cnpj: dto.cnpj } });
    if (existingOrg) throw new ConflictException(`Organization with CNPJ ${dto.cnpj} already exists`);

    const hasAddress = dto.city || dto.state || dto.street || dto.number || dto.neighborhood || dto.zipCode;

    return this.dataSource
      .transaction(async (manager) => {
        let address: AddressEntity | undefined;
        if (hasAddress) {
          address = await manager.save(
            manager.create(AddressEntity, {
              city: dto.city ?? '',
              state: dto.state ?? '',
              street: dto.street,
              number: dto.number,
              neighborhood: dto.neighborhood,
              zipCode: dto.zipCode,
            }),
          );
        }

        const organization = await manager.save(
          manager.create(OrganizationEntity, {
            name: dto.name,
            cnpj: dto.cnpj,
            isActive: true,
            ...(address ? { address } : {}),
          }),
        );

        return manager.save(
          manager.create(HotelEntity, { organization, municipality }),
        );
      })
      .catch((err: unknown) => {
        if (err instanceof ConflictException) throw err;
        if (
          typeof err === 'object' &&
          err !== null &&
          'code' in err &&
          (err as { code: string }).code === '23505'
        ) {
          throw new ConflictException(`Organization with CNPJ ${dto.cnpj} already exists`);
        }
        throw err;
      });
  }

  async updateHotel(id: string, dto: UpdateHotelDto, organizationId: string): Promise<HotelEntity> {
    const municipality = await this.getMunicipalityByOrganizationId(organizationId);

    const hotel = await this.dataSource
      .getRepository(HotelEntity)
      .findOne({ where: { id }, relations: { organization: { address: true }, municipality: true } });
    if (!hotel) throw new NotFoundException(`Hotel ${id} not found`);

    if (!hotel.municipality || hotel.municipality.id !== municipality.id) {
      throw new ForbiddenException('Hotel does not belong to your municipality');
    }

    if (dto.cnpj !== undefined) {
      const conflict = await this.dataSource
        .getRepository(OrganizationEntity)
        .findOne({ where: { cnpj: dto.cnpj } });
      if (conflict && conflict.id !== hotel.organization.id) {
        throw new ConflictException(`Organization with CNPJ ${dto.cnpj} already exists`);
      }
    }

    await this.dataSource.transaction(async (manager) => {
      const addressFields = ['city', 'state', 'street', 'number', 'neighborhood', 'zipCode'] as const;
      const hasAddressUpdates = addressFields.some((f) => dto[f] !== undefined);

      if (hasAddressUpdates) {
        if (hotel.organization.address) {
          const addressUpdates: Partial<AddressEntity> = {};
          if (dto.city !== undefined) addressUpdates.city = dto.city;
          if (dto.state !== undefined) addressUpdates.state = dto.state;
          if (dto.street !== undefined) addressUpdates.street = dto.street;
          if (dto.number !== undefined) addressUpdates.number = dto.number;
          if (dto.neighborhood !== undefined) addressUpdates.neighborhood = dto.neighborhood;
          if (dto.zipCode !== undefined) addressUpdates.zipCode = dto.zipCode;
          await manager.update(AddressEntity, { id: hotel.organization.address.id }, addressUpdates);
        } else {
          const address = await manager.save(
            manager.create(AddressEntity, {
              city: dto.city ?? '',
              state: dto.state ?? '',
              street: dto.street,
              number: dto.number,
              neighborhood: dto.neighborhood,
              zipCode: dto.zipCode,
            }),
          );
          await manager.update(OrganizationEntity, { id: hotel.organization.id }, { address });
        }
      }

      const orgUpdates: Partial<OrganizationEntity> = {};
      if (dto.name !== undefined) orgUpdates.name = dto.name;
      if (dto.cnpj !== undefined) orgUpdates.cnpj = dto.cnpj;
      if (dto.isActive !== undefined) orgUpdates.isActive = dto.isActive;
      if (Object.keys(orgUpdates).length > 0) {
        await manager.update(OrganizationEntity, { id: hotel.organization.id }, orgUpdates);
      }
    });

    return this.dataSource
      .getRepository(HotelEntity)
      .findOne({ where: { id }, relations: { organization: { address: true } } }) as Promise<HotelEntity>;
  }
}
