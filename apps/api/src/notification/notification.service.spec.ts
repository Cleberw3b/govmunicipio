import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { NotificationService } from './notification.service';
import { NotificationEntity } from '../entities';

// ── Helpers ──────────────────────────────────────────────────────────────────

const makeNotification = (
  overrides: Partial<NotificationEntity> = {},
): NotificationEntity =>
  ({
    id: 'notif-uuid-1',
    type: 'tfd_status_change',
    title: 'TFD Atualizado',
    message: 'Sua solicitacao foi aprovada',
    isRead: false,
    linkUrl: '/tfd/requests/req-1',
    recipient: { id: 'principal-uuid-1' },
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  }) as unknown as NotificationEntity;

describe('NotificationService', () => {
  let service: NotificationService;
  let repository: jest.Mocked<Partial<Repository<NotificationEntity>>>;

  beforeEach(async () => {
    repository = {
      create: jest.fn().mockImplementation((data) => ({ id: 'new-notif-uuid', ...data })),
      save: jest.fn().mockImplementation(async (entity) => entity),
      find: jest.fn(),
      findOne: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: getRepositoryToken(NotificationEntity), useValue: repository },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create and return a notification', async () => {
      const result = await service.create(
        'principal-uuid-1',
        'tfd_status_change',
        'TFD Atualizado',
        'Sua solicitacao foi aprovada',
        '/tfd/requests/req-1',
      );

      expect(repository.create).toHaveBeenCalledWith({
        recipient: { id: 'principal-uuid-1' },
        type: 'tfd_status_change',
        title: 'TFD Atualizado',
        message: 'Sua solicitacao foi aprovada',
        linkUrl: '/tfd/requests/req-1',
        isRead: false,
      });
      expect(repository.save).toHaveBeenCalled();
      expect(result).toHaveProperty('type', 'tfd_status_change');
    });

    it('should set linkUrl to null when not provided', async () => {
      await service.create(
        'principal-uuid-1',
        'user_created',
        'Novo usuario',
        'Um novo usuario foi criado',
      );

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ linkUrl: null }),
      );
    });
  });

  // ── findByRecipient ────────────────────────────────────────────────────────

  describe('findByRecipient', () => {
    it('should return a list of notifications for a recipient', async () => {
      const notifications = [makeNotification(), makeNotification({ id: 'notif-uuid-2' })];
      repository.find!.mockResolvedValue(notifications);

      const result = await service.findByRecipient('principal-uuid-1');

      expect(result).toHaveLength(2);
      expect(repository.find).toHaveBeenCalledWith({
        where: { recipient: { id: 'principal-uuid-1' } },
        order: { createdAt: 'DESC' },
        take: 50,
      });
    });

    it('should return empty array when recipient has no notifications', async () => {
      repository.find!.mockResolvedValue([]);

      const result = await service.findByRecipient('principal-uuid-no-notifs');

      expect(result).toEqual([]);
    });
  });

  // ── getUnreadCount ─────────────────────────────────────────────────────────

  describe('getUnreadCount', () => {
    it('should return correct unread count', async () => {
      repository.count!.mockResolvedValue(5);

      const result = await service.getUnreadCount('principal-uuid-1');

      expect(result).toBe(5);
      expect(repository.count).toHaveBeenCalledWith({
        where: {
          recipient: { id: 'principal-uuid-1' },
          isRead: false,
        },
      });
    });

    it('should return zero when all notifications are read', async () => {
      repository.count!.mockResolvedValue(0);

      const result = await service.getUnreadCount('principal-uuid-1');

      expect(result).toBe(0);
    });
  });

  // ── markAsRead ─────────────────────────────────────────────────────────────

  describe('markAsRead', () => {
    it('should mark a notification as read and return it', async () => {
      const notification = makeNotification();
      repository.findOne!.mockResolvedValue(notification);

      const result = await service.markAsRead('notif-uuid-1', 'principal-uuid-1');

      expect(result.isRead).toBe(true);
      expect(repository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when notification does not exist', async () => {
      repository.findOne!.mockResolvedValue(null);

      await expect(
        service.markAsRead('nonexistent', 'principal-uuid-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── markAllAsRead ──────────────────────────────────────────────────────────

  describe('markAllAsRead', () => {
    it('should update all unread notifications for the recipient', async () => {
      repository.update!.mockResolvedValue({ affected: 3 } as any);

      await service.markAllAsRead('principal-uuid-1');

      expect(repository.update).toHaveBeenCalledWith(
        { recipient: { id: 'principal-uuid-1' }, isRead: false },
        { isRead: true },
      );
    });

    it('should be a no-op (not throw) when no unread notifications exist', async () => {
      repository.update!.mockResolvedValue({ affected: 0 } as any);

      await expect(service.markAllAsRead('principal-uuid-1')).resolves.toBeUndefined();
    });
  });
});
