import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { OtpService } from './otp.service';
import { OtpTokenEntity } from '../entities/otp-token.entity';
import { PrincipalEntity } from '../entities';

jest.mock('bcryptjs');

describe('OtpService', () => {
  let service: OtpService;
  let dataSource: DataSource;
  let principalRepository: Repository<PrincipalEntity>;
  let otpRepository: Repository<OtpTokenEntity>;

  const mockPrincipal = {
    id: 'principal-1',
    username: 'testuser',
    passwordHash: 'hashed_password_old',
    isActive: true,
  };

  const mockOtpToken = {
    id: 'otp-1',
    principalId: 'principal-1',
    code: '123456',
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
    usedAt: null,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    principalRepository = {
      findOne: jest.fn(),
    } as unknown as Repository<PrincipalEntity>;

    otpRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as unknown as Repository<OtpTokenEntity>;

    dataSource = {
      getRepository: jest.fn((entity) => {
        if (entity === PrincipalEntity) return principalRepository;
        if (entity === OtpTokenEntity) return otpRepository;
        return null;
      }),
      transaction: jest.fn(),
    } as unknown as DataSource;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpService,
        {
          provide: getDataSourceToken(),
          useValue: dataSource,
        },
      ],
    }).compile();

    service = module.get<OtpService>(OtpService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('requestOtp', () => {
    it('should generate and save a new OTP code', async () => {
      (principalRepository.findOne as jest.Mock).mockResolvedValue(mockPrincipal);

      const queryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      };
      (otpRepository.createQueryBuilder as jest.Mock).mockReturnValue(queryBuilder);
      (otpRepository.create as jest.Mock).mockReturnValue(mockOtpToken);
      (otpRepository.save as jest.Mock).mockResolvedValue(mockOtpToken);

      const result = await service.requestOtp('testuser');

      expect(result).toMatch(/^\d{6}$/);
      expect(principalRepository.findOne).toHaveBeenCalledWith({
        where: { username: 'testuser' },
      });
      expect(otpRepository.save).toHaveBeenCalled();
      expect(queryBuilder.execute).toHaveBeenCalled();
    });

    it('should throw NotFoundException when user does not exist', async () => {
      (principalRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.requestOtp('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.requestOtp('nonexistent')).rejects.toThrow(
        'User "nonexistent" not found',
      );
    });

    it('should invalidate previous unused OTP codes for the principal', async () => {
      (principalRepository.findOne as jest.Mock).mockResolvedValue(mockPrincipal);

      const queryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      (otpRepository.createQueryBuilder as jest.Mock).mockReturnValue(queryBuilder);
      (otpRepository.create as jest.Mock).mockReturnValue(mockOtpToken);
      (otpRepository.save as jest.Mock).mockResolvedValue(mockOtpToken);

      await service.requestOtp('testuser');

      expect(queryBuilder.update).toHaveBeenCalledWith(OtpTokenEntity);
      expect(queryBuilder.set).toHaveBeenCalledWith({ usedAt: expect.any(Date) });
      expect(queryBuilder.where).toHaveBeenCalledWith(
        'principal_id = :id AND used_at IS NULL',
        { id: 'principal-1' },
      );
    });

    it('should generate a 6-digit OTP code', async () => {
      (principalRepository.findOne as jest.Mock).mockResolvedValue(mockPrincipal);
      const queryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      };
      (otpRepository.createQueryBuilder as jest.Mock).mockReturnValue(queryBuilder);
      (otpRepository.create as jest.Mock).mockReturnValue(mockOtpToken);
      (otpRepository.save as jest.Mock).mockResolvedValue(mockOtpToken);

      const result = await service.requestOtp('testuser');

      expect(result).toMatch(/^\d{6}$/);
      expect(parseInt(result)).toBeGreaterThanOrEqual(100000);
      expect(parseInt(result)).toBeLessThanOrEqual(999999);
    });

    it('should set OTP expiration to 15 minutes', async () => {
      const beforeTime = Date.now();
      (principalRepository.findOne as jest.Mock).mockResolvedValue(mockPrincipal);
      const queryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      };
      (otpRepository.createQueryBuilder as jest.Mock).mockReturnValue(queryBuilder);
      (otpRepository.create as jest.Mock).mockImplementation((entity, data) => data);
      (otpRepository.save as jest.Mock).mockImplementation((token) => Promise.resolve(token));

      await service.requestOtp('testuser');

      const saveCall = (otpRepository.save as jest.Mock).mock.calls[0][0];
      const expiryTime = saveCall.expiresAt.getTime();
      const expectedExpiry = beforeTime + 15 * 60 * 1000;

      expect(expiryTime).toBeGreaterThanOrEqual(expectedExpiry - 1000);
      expect(expiryTime).toBeLessThanOrEqual(expectedExpiry + 1000);
    });
  });

  describe('verifyOtp', () => {
    it('should update password when OTP is valid', async () => {
      const newPassword = 'newSecurePassword123';
      const hashedPassword = 'hashed_new_password';
      (principalRepository.findOne as jest.Mock).mockResolvedValue(mockPrincipal);
      (otpRepository.findOne as jest.Mock).mockResolvedValue(mockOtpToken);
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);

      const mockManager = {
        update: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      (dataSource.transaction as jest.Mock).mockImplementation((callback) =>
        callback(mockManager),
      );

      await service.verifyOtp('testuser', '123456', newPassword);

      expect(mockManager.update).toHaveBeenCalledWith(
        OtpTokenEntity,
        { id: 'otp-1' },
        { usedAt: expect.any(Date) },
      );
      expect(mockManager.update).toHaveBeenCalledWith(
        PrincipalEntity,
        { id: 'principal-1' },
        { passwordHash: hashedPassword },
      );
      expect(bcrypt.hash).toHaveBeenCalledWith(newPassword, 10);
    });

    it('should throw NotFoundException when user does not exist', async () => {
      (principalRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.verifyOtp('nonexistent', '123456', 'newPassword')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.verifyOtp('nonexistent', '123456', 'newPassword')).rejects.toThrow(
        'User "nonexistent" not found',
      );
    });

    it('should throw BadRequestException when OTP code is not found', async () => {
      (principalRepository.findOne as jest.Mock).mockResolvedValue(mockPrincipal);
      (otpRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.verifyOtp('testuser', '999999', 'newPassword')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.verifyOtp('testuser', '999999', 'newPassword')).rejects.toThrow(
        'Invalid OTP code',
      );
    });

    it('should throw BadRequestException when OTP has already been used', async () => {
      const usedOtp = { ...mockOtpToken, usedAt: new Date() };
      (principalRepository.findOne as jest.Mock).mockResolvedValue(mockPrincipal);
      (otpRepository.findOne as jest.Mock).mockResolvedValue(usedOtp);

      await expect(service.verifyOtp('testuser', '123456', 'newPassword')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.verifyOtp('testuser', '123456', 'newPassword')).rejects.toThrow(
        'OTP code has already been used',
      );
    });

    it('should throw BadRequestException when OTP has expired', async () => {
      const expiredOtp = {
        ...mockOtpToken,
        expiresAt: new Date(Date.now() - 1 * 60 * 1000), // 1 minute ago
      };
      (principalRepository.findOne as jest.Mock).mockResolvedValue(mockPrincipal);
      (otpRepository.findOne as jest.Mock).mockResolvedValue(expiredOtp);

      await expect(service.verifyOtp('testuser', '123456', 'newPassword')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.verifyOtp('testuser', '123456', 'newPassword')).rejects.toThrow(
        'OTP code has expired',
      );
    });

    it('should hash the new password with bcrypt using 10 rounds', async () => {
      const newPassword = 'SecureNewPassword123!';
      const hashedPassword = 'bcrypt_hashed_value';
      (principalRepository.findOne as jest.Mock).mockResolvedValue(mockPrincipal);
      (otpRepository.findOne as jest.Mock).mockResolvedValue(mockOtpToken);
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);

      const mockManager = {
        update: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      (dataSource.transaction as jest.Mock).mockImplementation((callback) =>
        callback(mockManager),
      );

      await service.verifyOtp('testuser', '123456', newPassword);

      expect(bcrypt.hash).toHaveBeenCalledWith(newPassword, 10);
    });

    it('should retrieve OTP with correct order (most recent first)', async () => {
      (principalRepository.findOne as jest.Mock).mockResolvedValue(mockPrincipal);
      (otpRepository.findOne as jest.Mock).mockResolvedValue(mockOtpToken);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');

      const mockManager = {
        update: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      (dataSource.transaction as jest.Mock).mockImplementation((callback) =>
        callback(mockManager),
      );

      await service.verifyOtp('testuser', '123456', 'newPassword');

      expect(otpRepository.findOne).toHaveBeenCalledWith({
        where: { principalId: 'principal-1', code: '123456' },
        order: { createdAt: 'DESC' },
      });
    });

    it('should use transaction to ensure atomicity of password and OTP updates', async () => {
      (principalRepository.findOne as jest.Mock).mockResolvedValue(mockPrincipal);
      (otpRepository.findOne as jest.Mock).mockResolvedValue(mockOtpToken);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');

      const mockManager = {
        update: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      (dataSource.transaction as jest.Mock).mockImplementation((callback) =>
        callback(mockManager),
      );

      await service.verifyOtp('testuser', '123456', 'newPassword');

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(mockManager.update).toHaveBeenCalledTimes(2);
    });
  });
});
