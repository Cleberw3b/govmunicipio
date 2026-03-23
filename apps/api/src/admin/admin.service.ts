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
import { Gender, IPaginatedResponse } from '@govmunicipio/shared';
import { paginate } from '../common';
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
  SpecialtyEntity,
  DoctorEntity,
  PrincipalRoleLinkEntity,
  PrincipalOrganizationLinkEntity,
  HospitalSpecialtyLinkEntity,
  DoctorSpecialtyLinkEntity,
  OrganizationAddressLinkEntity,
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
import { CreateSpecialtyDto } from './dto/create-specialty.dto';
import { UpdateSpecialtyDto } from './dto/update-specialty.dto';

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

    @InjectRepository(SpecialtyEntity)
    private readonly specialtyRepository: Repository<SpecialtyEntity>,

    @InjectRepository(HospitalEntity)
    private readonly hospitalRepository: Repository<HospitalEntity>,

    @InjectRepository(DoctorEntity)
    private readonly doctorRepository: Repository<DoctorEntity>,

    private readonly otpService: OtpService,
  ) {}

  async findAllMunicipalities(
    page: number = 1,
    limit: number = 20,
  ): Promise<IPaginatedResponse<MunicipalityEntity>> {
    const queryBuilder = this.municipalityRepository
      .createQueryBuilder('municipality')
      .leftJoinAndSelect('municipality.organization', 'organization')
      .leftJoinAndSelect('organization.addressLinks', 'addressLinks')
      .leftJoinAndSelect('addressLinks.address', 'address')
      .orderBy('municipality.created_at', 'DESC');

    return paginate(queryBuilder, page, limit);
  }

  async findMunicipalityById(id: string): Promise<MunicipalityEntity> {
    const municipality = await this.municipalityRepository.findOne({
      where: { id },
      relations: { organization: { addressLinks: { address: true }, contactLinks: { contact: true } } },
    });
    if (!municipality) {
      throw new NotFoundException(`Municipality ${id} not found`);
    }
    return municipality;
  }

  async findAllUsers(): Promise<PrincipalEntity[]> {
    return this.principalRepository.find({
      relations: { roleLinks: { role: true }, organizationLinks: { organization: true }, person: { identification: true } },
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
      await manager.save(principal);

      // Create role and organization links
      await manager.save(manager.create(PrincipalRoleLinkEntity, {
        principalId: principal.id,
        roleId: adminRole.id,
      }));
      await manager.save(manager.create(PrincipalOrganizationLinkEntity, {
        principalId: principal.id,
        organizationId: organization.id,
      }));

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
        const savedPrincipal = await manager.save(principal);

        // Create role links
        for (const role of roleEntities) {
          await manager.save(manager.create(PrincipalRoleLinkEntity, {
            principalId: savedPrincipal.id,
            roleId: role.id,
          }));
        }

        // Create organization link if present
        if (orgEntity) {
          await manager.save(manager.create(PrincipalOrganizationLinkEntity, {
            principalId: savedPrincipal.id,
            organizationId: orgEntity.id,
          }));
        }

        return savedPrincipal;
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
      .find({ relations: { addressLinks: { address: true } }, order: { name: 'ASC' } });
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
              street: dto.street ?? '',
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
          }),
        );

        // Create address link if address was created
        if (address) {
          await manager.save(manager.create(OrganizationAddressLinkEntity, {
            organizationId: organization.id,
            addressId: address.id,
          }));
        }

        return organization;
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
      .findOne({ where: { id }, relations: { addressLinks: { address: true } } });
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
        const existingAddress = org.addressLinks?.[0]?.address;
        if (existingAddress) {
          const addressUpdates: Partial<AddressEntity> = {};
          if (dto.city !== undefined) addressUpdates.city = dto.city;
          if (dto.state !== undefined) addressUpdates.state = dto.state;
          if (dto.street !== undefined) addressUpdates.street = dto.street;
          if (dto.number !== undefined) addressUpdates.number = dto.number;
          if (dto.neighborhood !== undefined) addressUpdates.neighborhood = dto.neighborhood;
          if (dto.zipCode !== undefined) addressUpdates.zipCode = dto.zipCode;
          await manager.update(AddressEntity, { id: existingAddress.id }, addressUpdates);
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
          await manager.save(manager.create(OrganizationAddressLinkEntity, {
            organizationId: id,
            addressId: address.id,
          }));
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
      .findOne({ where: { id }, relations: { addressLinks: { address: true } } }) as Promise<OrganizationEntity>;
  }

  async updateUser(id: string, dto: UpdateUserDto): Promise<PrincipalEntity> {
    const principal = await this.principalRepository.findOne({
      where: { id },
      relations: { person: { identification: true }, roleLinks: { role: true } },
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

        // Delete existing role links and create new ones
        await manager.delete(PrincipalRoleLinkEntity, { principalId: id });
        for (const role of roleEntities) {
          await manager.save(manager.create(PrincipalRoleLinkEntity, {
            principalId: id,
            roleId: role.id,
          }));
        }
      }

      if (dto.organizationId !== undefined) {
        if (dto.organizationId === null) {
          // Remove the organization and delete organization link
          await manager.update(PrincipalEntity, { id }, { organization: null });
          await manager.delete(PrincipalOrganizationLinkEntity, { principalId: id });
        } else {
          const org = await manager.findOne(OrganizationEntity, {
            where: { id: dto.organizationId },
          });
          if (!org) {
            throw new NotFoundException(
              `Organization ${dto.organizationId} not found`,
            );
          }

          // Update organization and recreate the link
          await manager.update(PrincipalEntity, { id }, { organization: org });
          await manager.delete(PrincipalOrganizationLinkEntity, { principalId: id });
          await manager.save(manager.create(PrincipalOrganizationLinkEntity, {
            principalId: id,
            organizationId: org.id,
          }));
        }
      }
    });

    return this.principalRepository.findOne({
      where: { id },
      relations: { roleLinks: { role: true }, organizationLinks: { organization: true }, person: { identification: true } },
    }) as Promise<PrincipalEntity>;
  }

  async findAllHospitals(
    page: number = 1,
    limit: number = 20,
  ): Promise<IPaginatedResponse<HospitalEntity>> {
    const queryBuilder = this.dataSource
      .getRepository(HospitalEntity)
      .createQueryBuilder('hospital')
      .leftJoinAndSelect('hospital.organization', 'organization')
      .leftJoinAndSelect('organization.addressLinks', 'addressLinks')
      .leftJoinAndSelect('addressLinks.address', 'address')
      .orderBy('hospital.created_at', 'DESC');

    return paginate(queryBuilder, page, limit);
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
              street: dto.street ?? '',
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
          }),
        );

        // Create address link if address was created
        if (address) {
          await manager.save(manager.create(OrganizationAddressLinkEntity, {
            organizationId: organization.id,
            addressId: address.id,
          }));
        }

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
      .findOne({ where: { id }, relations: { organization: { addressLinks: { address: true } } } });
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
        const existingAddress = hospital.organization.addressLinks?.[0]?.address;
        if (existingAddress) {
          const addressUpdates: Partial<AddressEntity> = {};
          if (dto.city !== undefined) addressUpdates.city = dto.city;
          if (dto.state !== undefined) addressUpdates.state = dto.state;
          if (dto.street !== undefined) addressUpdates.street = dto.street;
          if (dto.number !== undefined) addressUpdates.number = dto.number;
          if (dto.neighborhood !== undefined) addressUpdates.neighborhood = dto.neighborhood;
          if (dto.zipCode !== undefined) addressUpdates.zipCode = dto.zipCode;
          await manager.update(AddressEntity, { id: existingAddress.id }, addressUpdates);
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
          await manager.save(manager.create(OrganizationAddressLinkEntity, {
            organizationId: hospital.organization.id,
            addressId: address.id,
          }));
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
      .findOne({ where: { id }, relations: { organization: { addressLinks: { address: true } } } }) as Promise<HospitalEntity>;
  }

  async findAllHotels(
    page: number = 1,
    limit: number = 20,
  ): Promise<IPaginatedResponse<HotelEntity>> {
    const queryBuilder = this.dataSource
      .getRepository(HotelEntity)
      .createQueryBuilder('hotel')
      .leftJoinAndSelect('hotel.organization', 'organization')
      .leftJoinAndSelect('organization.addressLinks', 'addressLinks')
      .leftJoinAndSelect('addressLinks.address', 'address')
      .orderBy('hotel.created_at', 'DESC');

    return paginate(queryBuilder, page, limit);
  }

  async createHotel(dto: CreateHotelDto): Promise<HotelEntity> {
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
              street: dto.street ?? '',
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
          }),
        );

        // Create address link if address was created
        if (address) {
          await manager.save(manager.create(OrganizationAddressLinkEntity, {
            organizationId: organization.id,
            addressId: address.id,
          }));
        }

        return manager.save(
          manager.create(HotelEntity, { organization }),
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

  async updateHotel(id: string, dto: UpdateHotelDto): Promise<HotelEntity> {
    const hotel = await this.dataSource
      .getRepository(HotelEntity)
      .findOne({ where: { id }, relations: { organization: { addressLinks: { address: true } } } });
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
        const existingAddress = hotel.organization.addressLinks?.[0]?.address;
        if (existingAddress) {
          const addressUpdates: Partial<AddressEntity> = {};
          if (dto.city !== undefined) addressUpdates.city = dto.city;
          if (dto.state !== undefined) addressUpdates.state = dto.state;
          if (dto.street !== undefined) addressUpdates.street = dto.street;
          if (dto.number !== undefined) addressUpdates.number = dto.number;
          if (dto.neighborhood !== undefined) addressUpdates.neighborhood = dto.neighborhood;
          if (dto.zipCode !== undefined) addressUpdates.zipCode = dto.zipCode;
          await manager.update(AddressEntity, { id: existingAddress.id }, addressUpdates);
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
          await manager.save(manager.create(OrganizationAddressLinkEntity, {
            organizationId: hotel.organization.id,
            addressId: address.id,
          }));
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
      .findOne({ where: { id }, relations: { organization: { addressLinks: { address: true } } } }) as Promise<HotelEntity>;
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
        const existingAddress = municipality.organization.addressLinks?.[0]?.address;
        if (!existingAddress) {
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
          { id: existingAddress.id },
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

  // ─── Specialties ─────────────────────────────────────────────────────────────

  async findAllSpecialties(): Promise<SpecialtyEntity[]> {
    return this.specialtyRepository.find({ order: { code: 'ASC' } });
  }

  async createSpecialty(dto: CreateSpecialtyDto): Promise<SpecialtyEntity> {
    const existing = await this.specialtyRepository.findOne({ where: { code: dto.code } });
    if (existing) throw new ConflictException(`Specialty with code "${dto.code}" already exists`);

    const groupCode = dto.code.slice(0, 2);
    const GROUP_NAMES: Record<string, string> = {
      '01': 'Ações de promoção e prevenção em saúde',
      '02': 'Procedimentos com finalidade diagnóstica',
      '03': 'Procedimentos clínicos',
      '04': 'Procedimentos cirúrgicos',
      '05': 'Transplantes de órgãos, tecidos e células',
      '06': 'Medicamentos',
      '07': 'Órteses, próteses e materiais especiais',
      '08': 'Ações complementares da atenção à saúde',
      '09': 'Procedimentos para Ofertas de Cuidados Integrados',
    };

    return this.specialtyRepository.save(
      this.specialtyRepository.create({
        code: dto.code,
        name: dto.name,
        groupCode,
        groupName: GROUP_NAMES[groupCode] ?? null,
        price: dto.price ?? 0,
      }),
    );
  }

  async updateSpecialty(id: string, dto: UpdateSpecialtyDto): Promise<SpecialtyEntity> {
    const specialty = await this.specialtyRepository.findOne({ where: { id } });
    if (!specialty) throw new NotFoundException(`Specialty ${id} not found`);

    if (dto.name !== undefined) specialty.name = dto.name;
    if (dto.price !== undefined) specialty.price = dto.price;
    if (dto.isActive !== undefined) specialty.isActive = dto.isActive;

    return this.specialtyRepository.save(specialty);
  }

  // ─── Hospital ↔ Specialty ─────────────────────────────────────────────────

  async addSpecialtyToHospital(hospitalId: string, specialtyId: string): Promise<void> {
    const hospital = await this.hospitalRepository.findOne({
      where: { id: hospitalId },
      relations: { specialtyLinks: true },
    });
    if (!hospital) throw new NotFoundException(`Hospital ${hospitalId} not found`);

    const specialty = await this.specialtyRepository.findOne({ where: { id: specialtyId } });
    if (!specialty) throw new NotFoundException(`Specialty ${specialtyId} not found`);

    const alreadyLinked = hospital.specialtyLinks.some((sl) => sl.specialtyId === specialtyId);
    if (!alreadyLinked) {
      await this.dataSource
        .getRepository(HospitalSpecialtyLinkEntity)
        .save({ hospitalId, specialtyId });
    }
  }

  async removeSpecialtyFromHospital(hospitalId: string, specialtyId: string): Promise<void> {
    const hospital = await this.hospitalRepository.findOne({
      where: { id: hospitalId },
    });
    if (!hospital) throw new NotFoundException(`Hospital ${hospitalId} not found`);

    await this.dataSource
      .getRepository(HospitalSpecialtyLinkEntity)
      .softDelete({ hospitalId, specialtyId });
  }

  async findHospitalWithSpecialties(hospitalId: string): Promise<HospitalEntity> {
    const hospital = await this.hospitalRepository.findOne({
      where: { id: hospitalId },
      relations: { organization: true, specialtyLinks: { specialty: true } },
    });
    if (!hospital) throw new NotFoundException(`Hospital ${hospitalId} not found`);
    return hospital;
  }

  // ─── Doctor ↔ Specialty ───────────────────────────────────────────────────

  async findAllDoctors(): Promise<DoctorEntity[]> {
    return this.doctorRepository.find({
      relations: { person: true, specialtyLinks: { specialty: true } },
      order: { createdAt: 'DESC' },
    });
  }

  async addSpecialtyToDoctor(doctorId: string, specialtyId: string): Promise<void> {
    const doctor = await this.doctorRepository.findOne({
      where: { id: doctorId },
      relations: { specialtyLinks: true },
    });
    if (!doctor) throw new NotFoundException(`Doctor ${doctorId} not found`);

    const specialty = await this.specialtyRepository.findOne({ where: { id: specialtyId } });
    if (!specialty) throw new NotFoundException(`Specialty ${specialtyId} not found`);

    const alreadyLinked = doctor.specialtyLinks.some((sl) => sl.specialtyId === specialtyId);
    if (!alreadyLinked) {
      await this.dataSource
        .getRepository(DoctorSpecialtyLinkEntity)
        .save({ doctorId, specialtyId });
    }
  }

  async removeSpecialtyFromDoctor(doctorId: string, specialtyId: string): Promise<void> {
    const doctor = await this.doctorRepository.findOne({
      where: { id: doctorId },
    });
    if (!doctor) throw new NotFoundException(`Doctor ${doctorId} not found`);

    await this.dataSource
      .getRepository(DoctorSpecialtyLinkEntity)
      .softDelete({ doctorId, specialtyId });
  }
}
