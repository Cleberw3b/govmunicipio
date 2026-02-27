import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { OtpService } from '../auth/otp.service';
import { Gender } from '@govmunicipio/shared';
import {
  AddressEntity,
  OrganizationEntity,
  MunicipalityEntity,
  HospitalEntity,
  HotelEntity,
  PersonEntity,
  PersonIdentificationEntity,
  PrincipalEntity,
  RoleEntity,
} from '../entities';
import { CreateMunicipalityDto } from './dto/create-municipality.dto';
import { UpdateMunicipalityDto } from './dto/update-municipality.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { CreateHospitalDto } from './dto/create-hospital.dto';
import { UpdateHospitalDto } from './dto/update-hospital.dto';
import { CreateHotelDto } from './dto/create-hotel.dto';
import { UpdateHotelDto } from './dto/update-hotel.dto';

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

    private readonly otpService: OtpService,
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
      relations: { roles: true, organizations: true, person: { identification: true } },
      order: { createdAt: 'DESC' },
    });
  }

  async createMunicipalityWithAdmin(
    dto: CreateMunicipalityDto,
  ): Promise<{ municipality: MunicipalityEntity; otpCode: string }> {
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

    const tempPassword = crypto.randomBytes(32).toString('hex');
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const municipality = await this.dataSource.transaction(async (manager) => {
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
      const mun = await manager.save(
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

      return mun;
    });

    const otpCode = await this.otpService.requestOtp(dto.admin.username);
    return { municipality, otpCode };
  }

  async createUser(dto: CreateUserDto): Promise<{ user: PrincipalEntity; otpCode: string }> {
    const isSuperAdmin = dto.roles.includes('super_admin');

    if (!isSuperAdmin && (!dto.firstName || !dto.lastName || !dto.cpf)) {
      throw new BadRequestException('firstName, lastName, and cpf are required for non-super_admin users');
    }

    const existing = await this.principalRepository.findOne({ where: { username: dto.username } });
    if (existing) throw new ConflictException(`Username ${dto.username} already exists`);

    const roleEntities = await this.roleRepository.find({
      where: dto.roles.map((name) => ({ name })),
    });
    if (roleEntities.length !== dto.roles.length) {
      const found = roleEntities.map((r) => r.name);
      const missing = dto.roles.filter((n) => !found.includes(n));
      throw new NotFoundException(`Roles not found: ${missing.join(', ')}`);
    }

    let orgEntity: OrganizationEntity | undefined;
    if (dto.organizationId) {
      const org = await this.dataSource
        .getRepository(OrganizationEntity)
        .findOne({ where: { id: dto.organizationId } });
      if (!org) throw new NotFoundException(`Organization ${dto.organizationId} not found`);
      orgEntity = org;
    }

    const tempPassword = crypto.randomBytes(32).toString('hex');
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const user = await this.dataSource
      .transaction(async (manager) => {
        let person: PersonEntity | undefined;
        if (!isSuperAdmin) {
          person = await manager.save(
            manager.create(PersonEntity, {
              firstName: dto.firstName,
              lastName: dto.lastName,
              gender: Gender.NOT_INFORMED,
            }),
          );
          await manager.save(
            manager.create(PersonIdentificationEntity, {
              cpf: dto.cpf,
              dateOfBirth: '1990-01-01' as unknown as Date,
              person,
            }),
          );
        }

        const principal = manager.create(PrincipalEntity, {
          username: dto.username,
          passwordHash,
          isActive: true,
          email: dto.email ?? null,
          phone: dto.phone ?? null,
          ...(person ? { person, organization: orgEntity } : {}),
        });
        principal.roles = roleEntities;
        principal.organizations = orgEntity ? [orgEntity] : [];
        return manager.save(principal);
      })
      .catch((err: unknown) => {
        if (err instanceof ConflictException) throw err;
        if (err instanceof NotFoundException) throw err;
        if (err instanceof BadRequestException) throw err;
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

    const otpCode = await this.otpService.requestOtp(dto.username);
    return { user, otpCode };
  }

  async findAllOrganizations(): Promise<OrganizationEntity[]> {
    return this.dataSource
      .getRepository(OrganizationEntity)
      .find({ relations: { address: true }, order: { name: 'ASC' } });
  }

  async createOrganization(dto: CreateOrganizationDto): Promise<OrganizationEntity> {
    const existing = await this.dataSource
      .getRepository(OrganizationEntity)
      .findOne({ where: { cnpj: dto.cnpj } });
    if (existing) throw new ConflictException(`Organization with CNPJ ${dto.cnpj} already exists`);

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

  async updateOrganization(id: string, dto: UpdateOrganizationDto): Promise<OrganizationEntity> {
    const org = await this.dataSource
      .getRepository(OrganizationEntity)
      .findOne({ where: { id }, relations: { address: true } });
    if (!org) throw new NotFoundException(`Organization ${id} not found`);

    if (dto.cnpj !== undefined) {
      const conflict = await this.dataSource
        .getRepository(OrganizationEntity)
        .findOne({ where: { cnpj: dto.cnpj } });
      if (conflict && conflict.id !== id) {
        throw new ConflictException(`Organization with CNPJ ${dto.cnpj} already exists`);
      }
    }

    await this.dataSource.transaction(async (manager) => {
      const addressFields = ['city', 'state', 'street', 'number', 'neighborhood', 'zipCode'] as const;
      const hasAddressUpdates = addressFields.some((f) => dto[f] !== undefined);

      if (hasAddressUpdates) {
        if (org.address) {
          const addressUpdates: Partial<AddressEntity> = {};
          if (dto.city !== undefined) addressUpdates.city = dto.city;
          if (dto.state !== undefined) addressUpdates.state = dto.state;
          if (dto.street !== undefined) addressUpdates.street = dto.street;
          if (dto.number !== undefined) addressUpdates.number = dto.number;
          if (dto.neighborhood !== undefined) addressUpdates.neighborhood = dto.neighborhood;
          if (dto.zipCode !== undefined) addressUpdates.zipCode = dto.zipCode;
          await manager.update(AddressEntity, { id: org.address.id }, addressUpdates);
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
          await manager.update(OrganizationEntity, { id }, { address });
        }
      }

      const orgUpdates: Partial<OrganizationEntity> = {};
      if (dto.name !== undefined) orgUpdates.name = dto.name;
      if (dto.cnpj !== undefined) orgUpdates.cnpj = dto.cnpj;
      if (dto.isActive !== undefined) orgUpdates.isActive = dto.isActive;
      if (Object.keys(orgUpdates).length > 0) {
        await manager.update(OrganizationEntity, { id }, orgUpdates);
      }
    });

    return this.dataSource
      .getRepository(OrganizationEntity)
      .findOne({ where: { id }, relations: { address: true } }) as Promise<OrganizationEntity>;
  }

  async updateUser(id: string, dto: UpdateUserDto): Promise<PrincipalEntity> {
    const principal = await this.principalRepository.findOne({
      where: { id },
      relations: { person: { identification: true }, roles: true },
    });
    if (!principal) throw new NotFoundException(`User ${id} not found`);

    const personFieldsRequested =
      dto.firstName !== undefined || dto.lastName !== undefined || dto.cpf !== undefined;

    if (!principal.person && personFieldsRequested) {
      throw new BadRequestException(`User ${id} has no associated person record`);
    }

    const person = principal.person;

    await this.dataSource.transaction(async (manager) => {
      if (person) {
        const personUpdates: Partial<PersonEntity> = {};
        if (dto.firstName !== undefined) personUpdates.firstName = dto.firstName;
        if (dto.lastName !== undefined) personUpdates.lastName = dto.lastName;
        if (Object.keys(personUpdates).length > 0) {
          await manager.update(PersonEntity, { id: person.id }, personUpdates);
        }

        if (dto.cpf !== undefined) {
          if (!person.identification) {
            throw new BadRequestException(`User ${id} has no identification record`);
          }
          await manager.update(
            PersonIdentificationEntity,
            { id: person.identification.id },
            { cpf: dto.cpf },
          );
        }
      }

      const principalUpdates: Partial<PrincipalEntity> = {};
      if (dto.username !== undefined) principalUpdates.username = dto.username;
      if (dto.isActive !== undefined) principalUpdates.isActive = dto.isActive;
      if (Object.keys(principalUpdates).length > 0) {
        await manager.update(PrincipalEntity, { id }, principalUpdates);
      }

      if (dto.roles !== undefined) {
        const roleEntities = await manager.find(RoleEntity, {
          where: dto.roles.map((name) => ({ name })),
        });
        if (roleEntities.length !== dto.roles.length) {
          const found = roleEntities.map((r) => r.name);
          const missing = dto.roles.filter((n) => !found.includes(n));
          throw new NotFoundException(`Roles not found: ${missing.join(', ')}`);
        }
        const p = await manager.findOne(PrincipalEntity, {
          where: { id },
          relations: { roles: true },
        });
        p!.roles = roleEntities;
        await manager.save(p!);
      }

      if (dto.organizationId !== undefined) {
        const p = await manager.findOne(PrincipalEntity, {
          where: { id },
          relations: { organizations: true, organization: true },
        });
        if (!p) throw new NotFoundException(`User ${id} not found`);

        if (dto.organizationId === null) {
          p.organization = null;
          p.organizations = [];
        } else {
          const org = await manager.findOne(OrganizationEntity, {
            where: { id: dto.organizationId },
          });
          if (!org) {
            throw new NotFoundException(
              `Organization ${dto.organizationId} not found`,
            );
          }
          p.organization = org;
          p.organizations = [org];
        }
        await manager.save(p);
      }
    });

    return this.principalRepository.findOne({
      where: { id },
      relations: { roles: true, organizations: true, person: { identification: true } },
    }) as Promise<PrincipalEntity>;
  }

  async findAllHospitals(): Promise<HospitalEntity[]> {
    return this.dataSource
      .getRepository(HospitalEntity)
      .find({ relations: { organization: { address: true } }, order: { createdAt: 'DESC' } });
  }

  async createHospital(dto: CreateHospitalDto): Promise<HospitalEntity> {
    const existingOrg = await this.dataSource
      .getRepository(OrganizationEntity)
      .findOne({ where: { cnpj: dto.cnpj } });
    if (existingOrg) throw new ConflictException(`Organization with CNPJ ${dto.cnpj} already exists`);

    const existingHospital = await this.dataSource
      .getRepository(HospitalEntity)
      .findOne({ where: { cnesCode: dto.cnesCode } });
    if (existingHospital) throw new ConflictException(`Hospital with CNES code ${dto.cnesCode} already exists`);

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
          manager.create(HospitalEntity, { cnesCode: dto.cnesCode, organization }),
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
          throw new ConflictException(`Duplicate CNPJ or CNES code`);
        }
        throw err;
      });
  }

  async updateHospital(id: string, dto: UpdateHospitalDto): Promise<HospitalEntity> {
    const hospital = await this.dataSource
      .getRepository(HospitalEntity)
      .findOne({ where: { id }, relations: { organization: { address: true } } });
    if (!hospital) throw new NotFoundException(`Hospital ${id} not found`);

    if (dto.cnpj !== undefined) {
      const conflict = await this.dataSource
        .getRepository(OrganizationEntity)
        .findOne({ where: { cnpj: dto.cnpj } });
      if (conflict && conflict.id !== hospital.organization.id) {
        throw new ConflictException(`Organization with CNPJ ${dto.cnpj} already exists`);
      }
    }

    if (dto.cnesCode !== undefined) {
      const conflict = await this.dataSource
        .getRepository(HospitalEntity)
        .findOne({ where: { cnesCode: dto.cnesCode } });
      if (conflict && conflict.id !== id) {
        throw new ConflictException(`Hospital with CNES code ${dto.cnesCode} already exists`);
      }
    }

    await this.dataSource.transaction(async (manager) => {
      const addressFields = ['city', 'state', 'street', 'number', 'neighborhood', 'zipCode'] as const;
      const hasAddressUpdates = addressFields.some((f) => dto[f] !== undefined);

      if (hasAddressUpdates) {
        if (hospital.organization.address) {
          const addressUpdates: Partial<AddressEntity> = {};
          if (dto.city !== undefined) addressUpdates.city = dto.city;
          if (dto.state !== undefined) addressUpdates.state = dto.state;
          if (dto.street !== undefined) addressUpdates.street = dto.street;
          if (dto.number !== undefined) addressUpdates.number = dto.number;
          if (dto.neighborhood !== undefined) addressUpdates.neighborhood = dto.neighborhood;
          if (dto.zipCode !== undefined) addressUpdates.zipCode = dto.zipCode;
          await manager.update(AddressEntity, { id: hospital.organization.address.id }, addressUpdates);
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
          await manager.update(OrganizationEntity, { id: hospital.organization.id }, { address });
        }
      }

      const orgUpdates: Partial<OrganizationEntity> = {};
      if (dto.name !== undefined) orgUpdates.name = dto.name;
      if (dto.cnpj !== undefined) orgUpdates.cnpj = dto.cnpj;
      if (dto.isActive !== undefined) orgUpdates.isActive = dto.isActive;
      if (Object.keys(orgUpdates).length > 0) {
        await manager.update(OrganizationEntity, { id: hospital.organization.id }, orgUpdates);
      }

      if (dto.cnesCode !== undefined) {
        await manager.update(HospitalEntity, { id }, { cnesCode: dto.cnesCode });
      }
    });

    return this.dataSource
      .getRepository(HospitalEntity)
      .findOne({ where: { id }, relations: { organization: { address: true } } }) as Promise<HospitalEntity>;
  }

  async findAllHotels(): Promise<HotelEntity[]> {
    return this.dataSource
      .getRepository(HotelEntity)
      .find({
        relations: { organization: { address: true }, municipality: { organization: true } },
        order: { createdAt: 'DESC' },
      });
  }

  async createHotel(dto: CreateHotelDto): Promise<HotelEntity> {
    const existingOrg = await this.dataSource
      .getRepository(OrganizationEntity)
      .findOne({ where: { cnpj: dto.cnpj } });
    if (existingOrg) throw new ConflictException(`Organization with CNPJ ${dto.cnpj} already exists`);

    let municipality: MunicipalityEntity | null = null;
    if (dto.municipalityId) {
      municipality = await this.municipalityRepository.findOne({ where: { id: dto.municipalityId } }) ?? null;
      if (!municipality) throw new NotFoundException(`Municipality ${dto.municipalityId} not found`);
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
        if (err instanceof NotFoundException) throw err;
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

  async updateHotel(id: string, dto: UpdateHotelDto): Promise<HotelEntity> {
    const hotel = await this.dataSource
      .getRepository(HotelEntity)
      .findOne({ where: { id }, relations: { organization: { address: true }, municipality: true } });
    if (!hotel) throw new NotFoundException(`Hotel ${id} not found`);

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

      if (dto.municipalityId !== undefined) {
        if (dto.municipalityId === null) {
          await manager.update(HotelEntity, { id }, { municipality: null });
        } else {
          const mun = await manager.findOne(MunicipalityEntity, { where: { id: dto.municipalityId } });
          if (!mun) throw new NotFoundException(`Municipality ${dto.municipalityId} not found`);
          await manager.update(HotelEntity, { id }, { municipality: mun });
        }
      }
    });

    return this.dataSource
      .getRepository(HotelEntity)
      .findOne({ where: { id }, relations: { organization: { address: true }, municipality: { organization: true } } }) as Promise<HotelEntity>;
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
