import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { MunicipalityService } from './municipality.service';
import { OtpService } from '../auth/otp.service';
import {
  PrincipalEntity,
  RoleEntity,
  OrganizationEntity,
  MunicipalityEntity,
  HospitalEntity,
  MunicipalityHospitalLinkEntity,
} from '../entities';

// ── Helpers ──────────────────────────────────────────────────────────────────

const ORG_ID = 'org-uuid-1';
const MUNICIPALITY_ID = 'mun-uuid-1';
const HOSPITAL_ID = 'hospital-uuid-1';

const makeRole = (name: string): RoleEntity =>
  ({
    id: `role-${name}`,
    name,
    createdAt: new Date(),
    updatedAt: new Date(),
  }) as unknown as RoleEntity;

const makePrincipal = (overrides: Partial<PrincipalEntity> = {}): PrincipalEntity =>
  ({
    id: 'principal-uuid-1',
    username: 'maria.silva',
    isActive: true,
    person: {
      id: 'person-uuid-1',
      firstName: 'Maria',
      lastName: 'Silva',
      identification: { cpf: '529.982.247-25' },
    },
    roleLinks: [{ role: makeRole('operator_tfd') }],
    organizationLinks: [{ organization: { id: ORG_ID } }],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as unknown as PrincipalEntity;

describe('MunicipalityService', () => {
  let service: MunicipalityService;
  let principalRepository: jest.Mocked<Partial<Repository<PrincipalEntity>>>;
  let roleRepository: jest.Mocked<Partial<Repository<RoleEntity>>>;
  let otpService: jest.Mocked<Partial<OtpService>>;

  // Fine-grained repository mocks that getRepository() will return
  let orgRepoMock: Record<string, jest.Mock>;
  let municipalityRepoMock: Record<string, jest.Mock>;
  let hospitalRepoMock: Record<string, jest.Mock>;
  let hospitalLinkRepoMock: Record<string, jest.Mock>;
  let dataSource: Record<string, any>;

  beforeEach(async () => {
    // QueryBuilder mock for principalRepository
    const qbMock = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getOne: jest.fn().mockResolvedValue(null),
    };

    principalRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(qbMock),
    };

    roleRepository = {
      findOne: jest.fn(),
    };

    otpService = {
      requestOtp: jest.fn().mockResolvedValue('123456'),
    };

    orgRepoMock = {
      findOne: jest.fn(),
    };

    municipalityRepoMock = {
      findOne: jest.fn().mockResolvedValue({ id: MUNICIPALITY_ID }),
    };

    hospitalRepoMock = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
    };

    hospitalLinkRepoMock = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockImplementation(async (data) => data),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    dataSource = {
      getRepository: jest.fn().mockImplementation((entity: any) => {
        if (entity === OrganizationEntity) return orgRepoMock;
        if (entity === MunicipalityEntity) return municipalityRepoMock;
        if (entity === HospitalEntity) return hospitalRepoMock;
        if (entity === MunicipalityHospitalLinkEntity) return hospitalLinkRepoMock;
        return {};
      }),
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MunicipalityService,
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: getRepositoryToken(PrincipalEntity), useValue: principalRepository },
        { provide: getRepositoryToken(RoleEntity), useValue: roleRepository },
        { provide: OtpService, useValue: otpService },
      ],
    }).compile();

    service = module.get<MunicipalityService>(MunicipalityService);
  });

  // ── findUsers ──────────────────────────────────────────────────────────────

  describe('findUsers', () => {
    it('should return an array of users for the organization', async () => {
      const principals = [makePrincipal(), makePrincipal({ id: 'principal-uuid-2', username: 'joao.souza' })];
      const qb = (principalRepository.createQueryBuilder as jest.Mock)();
      qb.getMany.mockResolvedValue(principals);

      const result = await service.findUsers(ORG_ID);

      expect(result).toHaveLength(2);
      expect(principalRepository.createQueryBuilder).toHaveBeenCalledWith('p');
    });

    it('should return empty array when organization has no users', async () => {
      const qb = (principalRepository.createQueryBuilder as jest.Mock)();
      qb.getMany.mockResolvedValue([]);

      const result = await service.findUsers(ORG_ID);

      expect(result).toEqual([]);
    });
  });

  // ── createUser ─────────────────────────────────────────────────────────────

  describe('createUser', () => {
    const createDto = {
      username: 'new.user',
      firstName: 'Novo',
      lastName: 'Usuario',
      cpf: '529.982.247-25',
      role: 'operator_tfd',
    };

    it('should create a user and return user + OTP code', async () => {
      orgRepoMock.findOne.mockResolvedValue({ id: ORG_ID, name: 'Prefeitura' });
      roleRepository.findOne!.mockResolvedValue(makeRole('operator_tfd'));

      const createdPrincipal = makePrincipal({ username: 'new.user' });
      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = {
          findOne: jest.fn().mockResolvedValue(null), // no existing user
          create: jest.fn().mockImplementation((_Entity: any, data: any) => data),
          save: jest.fn().mockImplementation(async (_Entity: any, data: any) => ({
            id: 'new-principal-uuid',
            ...data,
          })),
        };
        return cb(manager);
      });

      const result = await service.createUser(createDto, ORG_ID);

      expect(result.user).toBeDefined();
      expect(result.otpCode).toBe('123456');
      expect(otpService.requestOtp).toHaveBeenCalledWith('new.user');
    });

    it('should throw ConflictException when username already exists', async () => {
      orgRepoMock.findOne.mockResolvedValue({ id: ORG_ID, name: 'Prefeitura' });
      roleRepository.findOne!.mockResolvedValue(makeRole('operator_tfd'));

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = {
          findOne: jest.fn().mockResolvedValue(makePrincipal()), // existing user
          create: jest.fn(),
          save: jest.fn(),
        };
        return cb(manager);
      });

      await expect(service.createUser(createDto, ORG_ID)).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException when role does not exist', async () => {
      orgRepoMock.findOne.mockResolvedValue({ id: ORG_ID, name: 'Prefeitura' });
      roleRepository.findOne!.mockResolvedValue(null);

      await expect(service.createUser(createDto, ORG_ID)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when organization does not exist', async () => {
      orgRepoMock.findOne.mockResolvedValue(null);

      await expect(service.createUser(createDto, ORG_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ── linkHospital ───────────────────────────────────────────────────────────

  describe('linkHospital', () => {
    it('should link a hospital to the municipality successfully', async () => {
      hospitalRepoMock.findOne.mockResolvedValue({ id: HOSPITAL_ID });
      hospitalLinkRepoMock.findOne.mockResolvedValue(null); // not already linked

      await service.linkHospital(HOSPITAL_ID, ORG_ID);

      expect(hospitalLinkRepoMock.save).toHaveBeenCalledWith({
        municipalityId: MUNICIPALITY_ID,
        hospitalId: HOSPITAL_ID,
      });
    });

    it('should silently return when the hospital is already linked', async () => {
      hospitalRepoMock.findOne.mockResolvedValue({ id: HOSPITAL_ID });
      hospitalLinkRepoMock.findOne.mockResolvedValue({
        municipalityId: MUNICIPALITY_ID,
        hospitalId: HOSPITAL_ID,
      }); // already linked

      await service.linkHospital(HOSPITAL_ID, ORG_ID);

      expect(hospitalLinkRepoMock.save).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when hospital does not exist', async () => {
      hospitalRepoMock.findOne.mockResolvedValue(null);

      await expect(
        service.linkHospital('nonexistent', ORG_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── unlinkHospital ─────────────────────────────────────────────────────────

  describe('unlinkHospital', () => {
    it('should delete the link between municipality and hospital', async () => {
      await service.unlinkHospital(HOSPITAL_ID, ORG_ID);

      expect(hospitalLinkRepoMock.delete).toHaveBeenCalledWith({
        municipalityId: MUNICIPALITY_ID,
        hospitalId: HOSPITAL_ID,
      });
    });

    it('should not throw when the link does not exist (delete affects 0 rows)', async () => {
      hospitalLinkRepoMock.delete.mockResolvedValue({ affected: 0 });

      await expect(
        service.unlinkHospital('no-link-hospital', ORG_ID),
      ).resolves.toBeUndefined();
    });
  });
});
