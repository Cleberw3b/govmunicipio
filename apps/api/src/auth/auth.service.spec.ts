import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrincipalEntity } from '../entities';

jest.mock('bcryptjs');

describe('AuthService', () => {
  let service: AuthService;
  let principalRepository: Repository<PrincipalEntity>;
  let jwtService: JwtService;

  const mockPermission1 = {
    id: 'perm-1',
    resource: 'tfd',
    action: 'read',
  };

  const mockPermission2 = {
    id: 'perm-2',
    resource: 'tfd',
    action: 'write',
  };

  const mockRole = {
    id: 'role-1',
    name: 'admin_municipality',
    permissionLinks: [
      { id: 'rpl-1', roleId: 'role-1', permissionId: 'perm-1', permission: mockPermission1 },
      { id: 'rpl-2', roleId: 'role-1', permissionId: 'perm-2', permission: mockPermission2 },
    ],
  };

  const mockOrganization = {
    id: 'org-1',
    name: 'Test Organization',
  };

  const mockPrincipal = {
    id: 'principal-1',
    username: 'testuser',
    passwordHash: 'hashed_password_123',
    isActive: true,
    lastLogin: null,
    roleLinks: [
      { id: 'prl-1', principalId: 'principal-1', roleId: 'role-1', role: mockRole },
    ],
    organizationLinks: [
      { id: 'pol-1', principalId: 'principal-1', organizationId: 'org-1', organization: mockOrganization },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(PrincipalEntity),
          useValue: {
            findOne: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    principalRepository = module.get<Repository<PrincipalEntity>>(
      getRepositoryToken(PrincipalEntity),
    );
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validatePrincipal', () => {
    it('should return a principal when credentials are valid', async () => {
      const password = 'correct_password';
      (principalRepository.findOne as jest.Mock).mockResolvedValue(mockPrincipal);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validatePrincipal('testuser', password);

      expect(result).toEqual(mockPrincipal);
      expect(principalRepository.findOne).toHaveBeenCalledWith({
        where: { username: 'testuser' },
        relations: {
          roleLinks: { role: { permissionLinks: { permission: true } } },
          organizationLinks: { organization: true },
        },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(password, mockPrincipal.passwordHash);
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      (principalRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.validatePrincipal('nonexistent', 'password')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.validatePrincipal('nonexistent', 'password')).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('should throw UnauthorizedException when user is inactive', async () => {
      const inactivePrincipal = { ...mockPrincipal, isActive: false };
      (principalRepository.findOne as jest.Mock).mockResolvedValue(inactivePrincipal);

      await expect(service.validatePrincipal('testuser', 'password')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.validatePrincipal('testuser', 'password')).rejects.toThrow(
        'Account is inactive',
      );
    });

    it('should throw UnauthorizedException when password is incorrect', async () => {
      (principalRepository.findOne as jest.Mock).mockResolvedValue(mockPrincipal);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.validatePrincipal('testuser', 'wrong_password')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.validatePrincipal('testuser', 'wrong_password')).rejects.toThrow(
        'Invalid credentials',
      );
    });
  });

  describe('login', () => {
    it('should return LoginResponseDto with valid JWT token', async () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
      (principalRepository.findOne as jest.Mock).mockResolvedValue(mockPrincipal);
      (jwtService.sign as jest.Mock).mockReturnValue(token);
      (principalRepository.update as jest.Mock).mockResolvedValue({ affected: 1 });

      const result = await service.login('principal-1', 'org-1');

      expect(result.accessToken).toBe(token);
      expect(result.principal.id).toBe('principal-1');
      expect(result.principal.username).toBe('testuser');
      expect(result.principal.roles).toContain('admin_municipality');
      expect(result.principal.permissions).toContain('tfd:read');
      expect(result.principal.permissions).toContain('tfd:write');
      expect(result.principal.organizationId).toBe('org-1');
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'principal-1',
        organizationId: 'org-1',
        roles: ['admin_municipality'],
        permissions: expect.arrayContaining(['tfd:read', 'tfd:write']),
      });
    });

    it('should use first organization when organizationId is not provided', async () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
      (principalRepository.findOne as jest.Mock).mockResolvedValue(mockPrincipal);
      (jwtService.sign as jest.Mock).mockReturnValue(token);
      (principalRepository.update as jest.Mock).mockResolvedValue({ affected: 1 });

      const result = await service.login('principal-1');

      expect(result.principal.organizationId).toBe('org-1');
    });

    it('should use empty string for organizationId when principal has no organizations', async () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
      const principalNoOrgs = { ...mockPrincipal, organizationLinks: [] };
      (principalRepository.findOne as jest.Mock).mockResolvedValue(principalNoOrgs);
      (jwtService.sign as jest.Mock).mockReturnValue(token);
      (principalRepository.update as jest.Mock).mockResolvedValue({ affected: 1 });

      const result = await service.login('principal-1');

      expect(result.principal.organizationId).toBe('');
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'principal-1',
        organizationId: '',
        roles: ['admin_municipality'],
        permissions: expect.arrayContaining(['tfd:read', 'tfd:write']),
      });
    });

    it('should throw UnauthorizedException when principal is not found', async () => {
      (principalRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.login('nonexistent-principal')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login('nonexistent-principal')).rejects.toThrow(
        'Principal not found',
      );
    });

    it('should update lastLogin timestamp', async () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
      (principalRepository.findOne as jest.Mock).mockResolvedValue(mockPrincipal);
      (jwtService.sign as jest.Mock).mockReturnValue(token);
      (principalRepository.update as jest.Mock).mockResolvedValue({ affected: 1 });

      await service.login('principal-1');

      expect(principalRepository.update).toHaveBeenCalledWith('principal-1', {
        lastLogin: expect.any(Date),
      });
    });

    it('should extract unique permissions from all roles', async () => {
      const token = 'token123';
      const perm1 = { id: 'p1', resource: 'tfd', action: 'read' };
      const perm2 = { id: 'p2', resource: 'tfd', action: 'write' };
      const perm3 = { id: 'p3', resource: 'tfd', action: 'submit' };

      const role1 = {
        id: 'role-1',
        name: 'admin_municipality',
        permissionLinks: [
          { roleId: 'role-1', permissionId: 'p1', permission: perm1 },
          { roleId: 'role-1', permissionId: 'p2', permission: perm2 },
        ],
      };

      const role2 = {
        id: 'role-2',
        name: 'operator_tfd',
        permissionLinks: [
          { roleId: 'role-2', permissionId: 'p1', permission: perm1 },
          { roleId: 'role-2', permissionId: 'p3', permission: perm3 },
        ],
      };

      const multiRolePrincipal = {
        ...mockPrincipal,
        roleLinks: [
          { principalId: 'principal-1', roleId: 'role-1', role: role1 },
          { principalId: 'principal-1', roleId: 'role-2', role: role2 },
        ],
      };
      (principalRepository.findOne as jest.Mock).mockResolvedValue(multiRolePrincipal);
      (jwtService.sign as jest.Mock).mockReturnValue(token);
      (principalRepository.update as jest.Mock).mockResolvedValue({ affected: 1 });

      const result = await service.login('principal-1');

      const permissions = result.principal.permissions;
      expect(permissions).toContain('tfd:read');
      expect(permissions).toContain('tfd:write');
      expect(permissions).toContain('tfd:submit');
      expect(new Set(permissions).size).toBe(permissions.length); // All unique
    });
  });
});
