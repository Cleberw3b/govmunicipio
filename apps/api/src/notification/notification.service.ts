import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationEntity } from '../entities';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notificationRepository: Repository<NotificationEntity>,
  ) {}

  async create(
    recipientId: string,
    type: string,
    title: string,
    message: string,
    linkUrl?: string,
  ): Promise<NotificationEntity> {
    const notification = this.notificationRepository.create({
      recipient: { id: recipientId },
      type,
      title,
      message,
      linkUrl: linkUrl || null,
      isRead: false,
    });

    return this.notificationRepository.save(notification);
  }

  async findByRecipient(
    recipientId: string,
    limit: number = 50,
  ): Promise<NotificationEntity[]> {
    return this.notificationRepository.find({
      where: { recipient: { id: recipientId } },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getUnreadCount(recipientId: string): Promise<number> {
    return this.notificationRepository.count({
      where: {
        recipient: { id: recipientId },
        isRead: false,
      },
    });
  }

  async markAsRead(
    id: string,
    recipientId: string,
  ): Promise<NotificationEntity> {
    const notification = await this.notificationRepository.findOne({
      where: { id, recipient: { id: recipientId } },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    notification.isRead = true;
    return this.notificationRepository.save(notification);
  }

  async markAllAsRead(recipientId: string): Promise<void> {
    await this.notificationRepository.update(
      { recipient: { id: recipientId }, isRead: false },
      { isRead: true },
    );
  }
}
