import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { OtpService } from '../auth/otp.service';
import { Gender } from '@govmunicipio/shared';
import {
  AddressEntity,
  PrincipalEntity,
  PersonEntity,
  PersonIdentificationEntity,
  OrganizationEntity,
  MunicipalityEntity,
  HospitalEntity,
  HotelEntity,
  RoleEntity,
  MunicipalityHospitalLinkEntity,
  MunicipalityHotelLinkEntity,
  PrincipalRoleLinkEntity,
  PrincipalOrganizationLinkEntity,
} from '../entities';
import { CreateMunicipalityUserDto } from './dto/create-municipality-user.dto';
import { UpdateMunicipalityUserDto } from './dto/update-municipality-user.dto';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { CreateMunicipalityHospitalDto } from './dto/create-hospital.dto';
import { CreateHotelDto } from './dto/create-hotel.dto';
import { CreatePickupAddressDto } from './dto/create-pickup-address.dto';
import { UpdatePickupAddressDto } from './dto/update-pickup-address.dto';
import { PickupAddressEntity } from '../entities';

@Injectable()
export class MunicipalityService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(PrincipalEntity)
    private readonly principalRepository: Repository<PrincipalEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepository: Repository<RoleEntity>,
    private readonly otpService: OtpService,
  ) {}

  async findUsers(organizationId: string): Promise<PrincipalEntity[]> {
    return this.principalRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.roleLinks', 'roleLink')
      .leftJoinAndSelect('roleLink.role', 'role')
      .leftJoinAndSelect('p.person', 'person')
      .leftJoinAndSelect('person.identification', 'identification')
      .leftJoinAndSelect('p.organizationLinks', 'orgLink')
      .leftJoinAndSelect('orgLink.organization', 'org')
      .where('org.id = :organizationId', { organizationId })
      .orderBy('p.createdAt', 'DESC')
      .getMany();
  }

  async createUser(
    dto: CreateMunicipalityUserDto,
    organizationId: string,
  ): Promise<{ user: PrincipalEntity; otpCode: string }> {
    const organization = await this.dataSource
      .getRepository(OrganizationEntity)
      .findOne({ where: { id: organizationId } });
    if (!organization) {
      throw new NotFoundException(`Organization not found`);
    }

    const role = await this.roleRepository.findOne({ where: { name: dto.role } });
    if (!role) throw new NotFoundException(`Role ${dto.role} not found`);

    const tempPassword = crypto.randomBytes(32).toString('hex');
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const user = await this.dataSource
      .transaction(async (manager) => {
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

        const principal = await manager.save(
          manager.create(PrincipalEntity, {
            username: dto.username,
            passwordHash,
            isActive: true,
            email: dto.email ?? null,
            phone: dto.phone ?? null,
            person,
          }),
        );

        await manager.save(
          manager.create(PrincipalRoleLinkEntity, {
            principal,
            role,
          }),
        );

        await manager.save(
          manager.create(PrincipalOrganizationLinkEntity, {
            principal,
            organization,
          }),
        );

        return principal;
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

    const otpCode = await this.otpService.requestOtp(dto.username);
    return { user, otpCode };
  }

  async updateUser(
    id: string,
    dto: UpdateMunicipalityUserDto,
    organizationId: string,
  ): Promise<PrincipalEntity> {
    const principal = await this.principalRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.roleLinks', 'roleLink')
      .leftJoinAndSelect('roleLink.role', 'role')
      .leftJoinAndSelect('p.person', 'person')
      .leftJoinAndSelect('person.identification', 'identification')
      .leftJoinAndSelect('p.organizationLinks', 'orgLink')
      .leftJoinAndSelect('orgLink.organization', 'org')
      .where('p.id = :id', { id })
      .getOne();

    if (!principal) throw new NotFoundException(`User ${id} not found`);

    const belongsToOrg = principal.organizationLinks.some((ol) => ol.organization.id === organizationId);
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
      if (Object.keys(principalUpdates).length > 0) {
        await manager.update(PrincipalEntity, { id }, principalUpdates);
      }

      if (dto.role !== undefined) {
        const roleEntity = await manager.findOne(RoleEntity, { where: { name: dto.role } });
        if (!roleEntity) throw new NotFoundException(`Role ${dto.role} not found`);
        const p = await manager.findOne(PrincipalEntity, {
          where: { id },
          relations: { roleLinks: true },
        });
        if (!p) throw new NotFoundException(`User ${id} not found`);

        // Delete existing role links
        await manager.delete(PrincipalRoleLinkEntity, { principal: { id } });

        // Create new role link
        await manager.save(
          manager.create(PrincipalRoleLinkEntity, {
            principal: p,
            role: roleEntity,
          }),
        );
      }
    });

    const updated = await this.principalRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.roleLinks', 'roleLink')
      .leftJoinAndSelect('roleLink.role', 'role')
      .leftJoinAndSelect('p.person', 'person')
      .leftJoinAndSelect('person.identification', 'identification')
      .leftJoinAndSelect('p.organizationLinks', 'orgLink')
      .leftJoinAndSelect('orgLink.organization', 'org')
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
      .leftJoinAndSelect('org.addressLinks', 'addressLinks')
      .leftJoinAndSelect('addressLinks.address', 'address')
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

  // ─── Hospitals ───────────────────────────────────────────────────────────────

  async createHospital(dto: CreateMunicipalityHospitalDto, organizationId: string): Promise<HospitalEntity> {
    const municipality = await this.getMunicipalityByOrganizationId(organizationId);

    const existingOrg = await this.dataSource
      .getRepository(OrganizationEntity)
      .findOne({ where: { cnpj: dto.cnpj } });
    if (existingOrg) throw new ConflictException(`Organization with CNPJ ${dto.cnpj} already exists`);

    const existingHospital = await this.dataSource
      .getRepository(HospitalEntity)
      .findOne({ where: { cnesCode: dto.cnesCode } });
    if (existingHospital) throw new ConflictException(`Hospital with CNES code ${dto.cnesCode} already exists`);

    const hasAddress = dto.city || dto.state || dto.street || dto.number || dto.neighborhood || dto.zipCode;

    const hospital = await this.dataSource
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

    await this.dataSource
      .getRepository(MunicipalityHospitalLinkEntity)
      .save({ municipalityId: municipality.id, hospitalId: hospital.id });

    return hospital;
  }

  async findLinkedHospitals(organizationId: string): Promise<HospitalEntity[]> {
    const municipality = await this.getMunicipalityByOrganizationId(organizationId);
    const links = await this.dataSource
      .getRepository(MunicipalityHospitalLinkEntity)
      .find({ where: { municipalityId: municipality.id } });
    if (links.length === 0) return [];
    return this.dataSource.getRepository(HospitalEntity).find({
      where: { id: In(links.map((l) => l.hospitalId)) },
      relations: { organization: { addressLinks: { address: true } } },
      order: { createdAt: 'DESC' },
    });
  }

  async findAvailableHospitals(organizationId: string): Promise<HospitalEntity[]> {
    const municipality = await this.getMunicipalityByOrganizationId(organizationId);
    const links = await this.dataSource
      .getRepository(MunicipalityHospitalLinkEntity)
      .find({ where: { municipalityId: municipality.id } });
    const linkedIds = links.map((l) => l.hospitalId);

    const qb = this.dataSource
      .getRepository(HospitalEntity)
      .createQueryBuilder('h')
      .leftJoinAndSelect('h.organization', 'org')
      .leftJoinAndSelect('org.addressLinks', 'addressLinks')
      .leftJoinAndSelect('addressLinks.address', 'address')
      .orderBy('org.name', 'ASC');

    if (linkedIds.length > 0) {
      qb.where('h.id NOT IN (:...linkedIds)', { linkedIds });
    }

    return qb.getMany();
  }

  async linkHospital(hospitalId: string, organizationId: string): Promise<void> {
    const municipality = await this.getMunicipalityByOrganizationId(organizationId);
    const hospital = await this.dataSource
      .getRepository(HospitalEntity)
      .findOne({ where: { id: hospitalId } });
    if (!hospital) throw new NotFoundException(`Hospital ${hospitalId} not found`);

    const existing = await this.dataSource
      .getRepository(MunicipalityHospitalLinkEntity)
      .findOne({ where: { municipalityId: municipality.id, hospitalId } });
    if (existing) return;

    await this.dataSource
      .getRepository(MunicipalityHospitalLinkEntity)
      .save({ municipalityId: municipality.id, hospitalId });
  }

  async unlinkHospital(hospitalId: string, organizationId: string): Promise<void> {
    const municipality = await this.getMunicipalityByOrganizationId(organizationId);
    await this.dataSource
      .getRepository(MunicipalityHospitalLinkEntity)
      .delete({ municipalityId: municipality.id, hospitalId });
  }

  // ─── Hotels ──────────────────────────────────────────────────────────────────

  async createHotel(dto: CreateHotelDto, organizationId: string): Promise<HotelEntity> {
    const municipality = await this.getMunicipalityByOrganizationId(organizationId);

    const existingOrg = await this.dataSource
      .getRepository(OrganizationEntity)
      .findOne({ where: { cnpj: dto.cnpj } });
    if (existingOrg) throw new ConflictException(`Organization with CNPJ ${dto.cnpj} already exists`);

    const hasAddress = dto.city || dto.state || dto.street || dto.number || dto.neighborhood || dto.zipCode;

    const hotel = await this.dataSource
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

    await this.dataSource
      .getRepository(MunicipalityHotelLinkEntity)
      .save({ municipalityId: municipality.id, hotelId: hotel.id });

    return hotel;
  }

  async findLinkedHotels(organizationId: string): Promise<HotelEntity[]> {
    const municipality = await this.getMunicipalityByOrganizationId(organizationId);
    const links = await this.dataSource
      .getRepository(MunicipalityHotelLinkEntity)
      .find({ where: { municipalityId: municipality.id } });
    if (links.length === 0) return [];
    return this.dataSource.getRepository(HotelEntity).find({
      where: { id: In(links.map((l) => l.hotelId)) },
      relations: { organization: { addressLinks: { address: true } } },
      order: { createdAt: 'DESC' },
    });
  }

  async findAvailableHotels(organizationId: string): Promise<HotelEntity[]> {
    const municipality = await this.getMunicipalityByOrganizationId(organizationId);
    const links = await this.dataSource
      .getRepository(MunicipalityHotelLinkEntity)
      .find({ where: { municipalityId: municipality.id } });
    const linkedIds = links.map((l) => l.hotelId);

    const qb = this.dataSource
      .getRepository(HotelEntity)
      .createQueryBuilder('h')
      .leftJoinAndSelect('h.organization', 'org')
      .leftJoinAndSelect('org.addressLinks', 'addressLinks')
      .leftJoinAndSelect('addressLinks.address', 'address')
      .orderBy('org.name', 'ASC');

    if (linkedIds.length > 0) {
      qb.where('h.id NOT IN (:...linkedIds)', { linkedIds });
    }

    return qb.getMany();
  }

  async linkHotel(hotelId: string, organizationId: string): Promise<void> {
    const municipality = await this.getMunicipalityByOrganizationId(organizationId);
    const hotel = await this.dataSource
      .getRepository(HotelEntity)
      .findOne({ where: { id: hotelId } });
    if (!hotel) throw new NotFoundException(`Hotel ${hotelId} not found`);

    const existing = await this.dataSource
      .getRepository(MunicipalityHotelLinkEntity)
      .findOne({ where: { municipalityId: municipality.id, hotelId } });
    if (existing) return;

    await this.dataSource
      .getRepository(MunicipalityHotelLinkEntity)
      .save({ municipalityId: municipality.id, hotelId });
  }

  async unlinkHotel(hotelId: string, organizationId: string): Promise<void> {
    const municipality = await this.getMunicipalityByOrganizationId(organizationId);
    await this.dataSource
      .getRepository(MunicipalityHotelLinkEntity)
      .delete({ municipalityId: municipality.id, hotelId });
  }

  // ─── Pickup Addresses ────────────────────────────────────────────────────────

  async findPickupAddresses(organizationId: string): Promise<PickupAddressEntity[]> {
    const municipality = await this.getMunicipalityByOrganizationId(organizationId);
    return this.dataSource.getRepository(PickupAddressEntity).find({
      where: { municipality: { id: municipality.id } },
      order: { name: 'ASC' },
    });
  }

  async createPickupAddress(dto: CreatePickupAddressDto, organizationId: string): Promise<PickupAddressEntity> {
    const municipality = await this.getMunicipalityByOrganizationId(organizationId);
    const repo = this.dataSource.getRepository(PickupAddressEntity);
    const address = repo.create({ ...dto, municipality: { id: municipality.id } });
    return repo.save(address);
  }

  async updatePickupAddress(id: string, dto: UpdatePickupAddressDto, organizationId: string): Promise<PickupAddressEntity> {
    const municipality = await this.getMunicipalityByOrganizationId(organizationId);
    const repo = this.dataSource.getRepository(PickupAddressEntity);
    const address = await repo.findOne({ where: { id, municipality: { id: municipality.id } } });
    if (!address) throw new NotFoundException(`Pickup address ${id} not found`);
    Object.assign(address, dto);
    return repo.save(address);
  }

  async deletePickupAddress(id: string, organizationId: string): Promise<void> {
    const municipality = await this.getMunicipalityByOrganizationId(organizationId);
    const repo = this.dataSource.getRepository(PickupAddressEntity);
    const address = await repo.findOne({ where: { id, municipality: { id: municipality.id } } });
    if (!address) throw new NotFoundException(`Pickup address ${id} not found`);
    await repo.softDelete({ id });
  }
}
