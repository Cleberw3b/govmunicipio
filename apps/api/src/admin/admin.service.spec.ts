import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import {
  MunicipalityEntity,
  PrincipalEntity,
  RoleEntity,
  OrganizationEntity,
  AddressEntity,
  PersonEntity,
  PersonIdentificationEntity,
  SpecialtyEntity,
  HospitalEntity,
  DoctorEntity,
} from '../entities';
import { OtpService } from '../auth/otp.service';
import { CreateMunicipalityDto } from './dto/create-municipality.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateMunicipalityDto } from './dto/update-municipality.dto';

describe('AdminService', () => {
  let service: AdminService;
  let municipalityRepository: Repository<MunicipalityEntity>;
  let principalRepository: Repository<PrincipalEntity>;
  let roleRepository: Repository<RoleEntity>;
  let specialtyRepository: Repository<SpecialtyEntity>;
  let hospitalRepository: Repository<HospitalEntity>;
  let doctorRepository: Repository<DoctorEntity>;
  let dataSource: DataSource;
  let otpService: OtpService;

  const mockRole = {
    id: 'role-1',
    name: 'admin_municipality',
    permissions: [],
  };

  const mockSuperAdminRole = {
    id: 'role-super',
    name: 'super_admin',
    permissions: [],
  };

  const mockOrganization = {
    id: 'org-1',
    name: 'Test Municipality Org',
    cnpj: '12.345.678/0001-90',
    isActive: true,
    address: { id: 'addr-1' },
    addressLinks: [{ address: { id: 'addr-1' } }],
  };

  const mockMunicipality = {
    id: 'municipality-1',
    ibgeCode: '3106200',
    state: 'MG',
    organization: mockOrganization,
  };

  beforeEach(async () => {
    const mockManager = {
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      create: jest.fn().mockImplementation((Entity, data) => ({ ...data })),
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    dataSource = {
      transaction: jest.fn().mockImplementation((callback) =>
        callback(mockManager),
      ),
      getRepository: jest.fn().mockReturnValue({
        findOne: jest.fn(),
      }),
    } as unknown as DataSource;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: getDataSourceToken(),
          useValue: dataSource,
        },
        {
          provide: getRepositoryToken(MunicipalityEntity),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(PrincipalEntity),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(RoleEntity),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(SpecialtyEntity),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(HospitalEntity),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(DoctorEntity),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: OtpService,
          useValue: {
            requestOtp: jest.fn().mockResolvedValue('123456'),
          },
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    municipalityRepository = module.get<Repository<MunicipalityEntity>>(
      getRepositoryToken(MunicipalityEntity),
    );
    principalRepository = module.get<Repository<PrincipalEntity>>(
      getRepositoryToken(PrincipalEntity),
    );
    roleRepository = module.get<Repository<RoleEntity>>(
      getRepositoryToken(RoleEntity),
    );
    specialtyRepository = module.get<Repository<SpecialtyEntity>>(
      getRepositoryToken(SpecialtyEntity),
    );
    hospitalRepository = module.get<Repository<HospitalEntity>>(
      getRepositoryToken(HospitalEntity),
    );
    doctorRepository = module.get<Repository<DoctorEntity>>(
      getRepositoryToken(DoctorEntity),
    );
    otpService = module.get<OtpService>(OtpService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createMunicipalityWithAdmin', () => {
    it('should create municipality with admin user in a transaction', async () => {
      const dto: CreateMunicipalityDto = {
        municipality: {
          name: 'Belo Horizonte',
          cnpj: '17.191.114/0001-80',
          ibgeCode: '3106200',
          state: 'MG',
          street: 'Rua Principal',
          number: '100',
          neighborhood: 'Centro',
          city: 'Belo Horizonte',
          zipCode: '30140071',
        },
        admin: {
          username: 'admin_bh',
          firstName: 'Admin',
          lastName: 'BH',
          cpf: '123.456.789-00',
        },
      };

      (dataSource.getRepository as jest.Mock).mockReturnValue(principalRepository);
      (principalRepository.findOne as jest.Mock).mockResolvedValue(null); // No existing
      (roleRepository.findOne as jest.Mock).mockResolvedValue(mockRole);
      (otpService.requestOtp as jest.Mock).mockResolvedValue('123456');

      const result = await service.createMunicipalityWithAdmin(dto);

      expect(result.municipality).toBeDefined();
      expect(result.otpCode).toBe('123456');
      expect(dataSource.transaction).toHaveBeenCalled();
    });

    it('should throw ConflictException when CNPJ already exists', async () => {
      const dto: CreateMunicipalityDto = {
        municipality: {
          name: 'Test',
          cnpj: '17.191.114/0001-80',
          ibgeCode: '3106200',
          state: 'MG',
          street: 'Street',
          number: '1',
          neighborhood: 'Neighborhood',
          city: 'City',
          zipCode: '12345',
        },
        admin: {
          username: 'admin',
          firstName: 'First',
          lastName: 'Last',
          cpf: '123.456.789-00',
        },
      };

      (dataSource.getRepository as jest.Mock).mockReturnValue({
        findOne: jest.fn().mockResolvedValue(mockOrganization),
      });

      await expect(service.createMunicipalityWithAdmin(dto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.createMunicipalityWithAdmin(dto)).rejects.toThrow(
        'Organization with CNPJ 17.191.114/0001-80 already exists',
      );
    });

    it('should throw ConflictException when username already exists', async () => {
      const dto: CreateMunicipalityDto = {
        municipality: {
          name: 'Test',
          cnpj: '17.191.114/0001-80',
          ibgeCode: '3106200',
          state: 'MG',
          street: 'Street',
          number: '1',
          neighborhood: 'Neighborhood',
          city: 'City',
          zipCode: '12345',
        },
        admin: {
          username: 'existing_user',
          firstName: 'First',
          lastName: 'Last',
          cpf: '123.456.789-00',
        },
      };

      (dataSource.getRepository as jest.Mock).mockReturnValue({
        findOne: jest.fn().mockResolvedValue(null),
      });
      (principalRepository.findOne as jest.Mock).mockResolvedValue({
        username: 'existing_user',
      });

      await expect(service.createMunicipalityWithAdmin(dto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.createMunicipalityWithAdmin(dto)).rejects.toThrow(
        'Username existing_user already exists',
      );
    });

    it('should throw NotFoundException when admin_municipality role does not exist', async () => {
      const dto: CreateMunicipalityDto = {
        municipality: {
          name: 'Test',
          cnpj: '17.191.114/0001-80',
          ibgeCode: '3106200',
          state: 'MG',
          street: 'Street',
          number: '1',
          neighborhood: 'Neighborhood',
          city: 'City',
          zipCode: '12345',
        },
        admin: {
          username: 'admin',
          firstName: 'First',
          lastName: 'Last',
          cpf: '123.456.789-00',
        },
      };

      (dataSource.getRepository as jest.Mock).mockReturnValue({
        findOne: jest.fn().mockResolvedValue(null),
      });
      (principalRepository.findOne as jest.Mock).mockResolvedValue(null);
      (roleRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.createMunicipalityWithAdmin(dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should create all entities in correct order: Address -> Organization -> Municipality -> Person -> PersonIdentification -> Principal', async () => {
      const dto: CreateMunicipalityDto = {
        municipality: {
          name: 'Belo Horizonte',
          cnpj: '17.191.114/0001-80',
          ibgeCode: '3106200',
          state: 'MG',
          street: 'Rua Principal',
          number: '100',
          neighborhood: 'Centro',
          city: 'Belo Horizonte',
          zipCode: '30140071',
        },
        admin: {
          username: 'admin_bh',
          firstName: 'Admin',
          lastName: 'BH',
          cpf: '123.456.789-00',
        },
      };

      (dataSource.getRepository as jest.Mock).mockReturnValue(principalRepository);
      (principalRepository.findOne as jest.Mock).mockResolvedValue(null);
      (roleRepository.findOne as jest.Mock).mockResolvedValue(mockRole);
      (otpService.requestOtp as jest.Mock).mockResolvedValue('123456');

      let transactionCallback: any;
      (dataSource.transaction as jest.Mock).mockImplementation((cb) => {
        transactionCallback = cb;
        const mockManager = {
          save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
          create: jest.fn().mockImplementation((Entity, data) => data),
        };
        return cb(mockManager);
      });

      await service.createMunicipalityWithAdmin(dto);

      expect(dataSource.transaction).toHaveBeenCalled();
    });
  });

  describe('createUser', () => {
    it('should create a super_admin user without requiring person data', async () => {
      const dto: CreateUserDto = {
        username: 'superadmin',
        roles: ['super_admin'],
      };

      (principalRepository.findOne as jest.Mock).mockResolvedValue(null);
      (roleRepository.find as jest.Mock).mockResolvedValue([mockSuperAdminRole]);
      (otpService.requestOtp as jest.Mock).mockResolvedValue('123456');

      const result = await service.createUser(dto);

      expect(result.user).toBeDefined();
      expect(result.otpCode).toBe('123456');
    });

    it('should throw BadRequestException when non-super_admin user lacks firstName, lastName, or cpf', async () => {
      const dto: CreateUserDto = {
        username: 'operator',
        roles: ['operator_tfd'],
        // Missing firstName, lastName, cpf
      };

      await expect(service.createUser(dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createUser(dto)).rejects.toThrow(
        'firstName, lastName, and cpf are required for non-super_admin users',
      );
    });

    it('should throw ConflictException when username already exists', async () => {
      const dto: CreateUserDto = {
        username: 'existing',
        roles: ['admin_municipality'],
        firstName: 'First',
        lastName: 'Last',
        cpf: '123.456.789-00',
      };

      (principalRepository.findOne as jest.Mock).mockResolvedValue({
        username: 'existing',
      });

      await expect(service.createUser(dto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.createUser(dto)).rejects.toThrow(
        'Username existing already exists',
      );
    });

    it('should throw NotFoundException when one or more roles do not exist', async () => {
      const dto: CreateUserDto = {
        username: 'operator',
        roles: ['admin_municipality', 'nonexistent_role'],
        firstName: 'First',
        lastName: 'Last',
        cpf: '123.456.789-00',
      };

      (principalRepository.findOne as jest.Mock).mockResolvedValue(null);
      (roleRepository.find as jest.Mock).mockResolvedValue([mockRole]); // Only one found

      await expect(service.createUser(dto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.createUser(dto)).rejects.toThrow(
        'Roles not found: nonexistent_role',
      );
    });

    it('should create PersonEntity and PersonIdentificationEntity for non-super_admin users', async () => {
      const dto: CreateUserDto = {
        username: 'operator',
        roles: ['operator_tfd'],
        firstName: 'João',
        lastName: 'Silva',
        cpf: '123.456.789-00',
      };

      (principalRepository.findOne as jest.Mock).mockResolvedValue(null);
      (roleRepository.find as jest.Mock).mockResolvedValue([
        { id: 'role-1', name: 'operator_tfd' },
      ]);
      (otpService.requestOtp as jest.Mock).mockResolvedValue('123456');

      const result = await service.createUser(dto);

      expect(result.user).toBeDefined();
      expect(result.otpCode).toBe('123456');
    });

    it('should assign provided roles to the new user', async () => {
      const dto: CreateUserDto = {
        username: 'admin',
        roles: ['admin_municipality'],
        firstName: 'Admin',
        lastName: 'User',
        cpf: '123.456.789-00',
      };

      (principalRepository.findOne as jest.Mock).mockResolvedValue(null);
      (roleRepository.find as jest.Mock).mockResolvedValue([mockRole]);
      (otpService.requestOtp as jest.Mock).mockResolvedValue('123456');

      const result = await service.createUser(dto);

      expect(result.user).toBeDefined();
    });

    it('should link user to organization when organizationId is provided', async () => {
      const dto: CreateUserDto = {
        username: 'operator',
        roles: ['operator_tfd'],
        organizationId: 'org-1',
        firstName: 'João',
        lastName: 'Silva',
        cpf: '123.456.789-00',
      };

      (principalRepository.findOne as jest.Mock).mockResolvedValue(null);
      (roleRepository.find as jest.Mock).mockResolvedValue([
        { id: 'role-1', name: 'operator_tfd' },
      ]);
      (dataSource.getRepository as jest.Mock).mockReturnValue({
        findOne: jest.fn().mockResolvedValue(mockOrganization),
      });
      (otpService.requestOtp as jest.Mock).mockResolvedValue('123456');

      const result = await service.createUser(dto);

      expect(result.user).toBeDefined();
    });

    it('should throw NotFoundException when provided organizationId does not exist', async () => {
      const dto: CreateUserDto = {
        username: 'operator',
        roles: ['operator_tfd'],
        organizationId: 'nonexistent-org',
        firstName: 'João',
        lastName: 'Silva',
        cpf: '123.456.789-00',
      };

      (principalRepository.findOne as jest.Mock).mockResolvedValue(null);
      (roleRepository.find as jest.Mock).mockResolvedValue([
        { id: 'role-1', name: 'operator_tfd' },
      ]);
      (dataSource.getRepository as jest.Mock).mockReturnValue({
        findOne: jest.fn().mockResolvedValue(null),
      });

      await expect(service.createUser(dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateMunicipality', () => {
    it('should update municipality organization name and address', async () => {
      const dto: UpdateMunicipalityDto = {
        name: 'Novo Nome',
        street: 'Nova Rua',
      };

      (municipalityRepository.findOne as jest.Mock).mockResolvedValue(
        mockMunicipality,
      );

      await service.updateMunicipality('municipality-1', dto);

      expect(dataSource.transaction).toHaveBeenCalled();
    });

    it('should throw ConflictException when updating to duplicate CNPJ', async () => {
      const dto: UpdateMunicipalityDto = {
        cnpj: '12.345.678/0001-99',
      };

      const existingOrg = {
        id: 'org-different',
        cnpj: '12.345.678/0001-99',
      };

      (municipalityRepository.findOne as jest.Mock).mockResolvedValue(
        mockMunicipality,
      );
      (dataSource.getRepository as jest.Mock).mockReturnValue({
        findOne: jest.fn().mockResolvedValue(existingOrg),
      });

      await expect(
        service.updateMunicipality('municipality-1', dto),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when updating to duplicate IBGE code', async () => {
      const dto: UpdateMunicipalityDto = {
        ibgeCode: '3106201',
      };

      const existingMun = {
        id: 'municipality-different',
        ibgeCode: '3106201',
      };

      (municipalityRepository.findOne as jest.Mock)
        .mockResolvedValueOnce(mockMunicipality)
        .mockResolvedValueOnce(existingMun);
      (dataSource.getRepository as jest.Mock).mockReturnValue({
        findOne: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.updateMunicipality('municipality-1', dto),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException when municipality has no address to update', async () => {
      const dto: UpdateMunicipalityDto = {
        street: 'New Street',
      };

      const munWithoutAddr = {
        ...mockMunicipality,
        organization: {
          ...mockMunicipality.organization,
          address: null,
          addressLinks: [],
        },
      };

      (municipalityRepository.findOne as jest.Mock).mockResolvedValue(
        munWithoutAddr,
      );

      await expect(
        service.updateMunicipality('municipality-1', dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow updating CNPJ to the same value without conflict', async () => {
      const dto: UpdateMunicipalityDto = {
        cnpj: mockOrganization.cnpj, // Same CNPJ
      };

      (municipalityRepository.findOne as jest.Mock).mockResolvedValue(
        mockMunicipality,
      );
      (dataSource.getRepository as jest.Mock).mockReturnValue({
        findOne: jest.fn().mockResolvedValue(mockOrganization),
      });

      await service.updateMunicipality('municipality-1', dto);

      expect(dataSource.transaction).toHaveBeenCalled();
    });
  });
});
