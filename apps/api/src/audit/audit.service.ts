import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntity } from '../entities';

export interface AuditFilters {
  entityType?: string;
  actorId?: string;
  action?: string;
  from?: Date;
  to?: Date;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditLogRepository: Repository<AuditLogEntity>,
  ) {}

  async log(
    actorId: string,
    action: string,
    entityType: string,
    entityId: string,
    oldValues?: Record<string, any>,
    newValues?: Record<string, any>,
    ipAddress?: string,
  ): Promise<AuditLogEntity> {
    const auditLog = this.auditLogRepository.create({
      actorId,
      action,
      entityType,
      entityId,
      oldValues: oldValues || null,
      newValues: newValues || null,
      ipAddress: ipAddress || null,
    });

    return this.auditLogRepository.save(auditLog);
  }

  async findAll(
    filters?: AuditFilters,
    page: number = 1,
    limit: number = 50,
  ): Promise<{ data: AuditLogEntity[]; total: number }> {
    const query = this.auditLogRepository.createQueryBuilder('audit');

    if (filters?.entityType) {
      query.andWhere('audit.entityType = :entityType', {
        entityType: filters.entityType,
      });
    }

    if (filters?.actorId) {
      query.andWhere('audit.actorId = :actorId', { actorId: filters.actorId });
    }

    if (filters?.action) {
      query.andWhere('audit.action = :action', { action: filters.action });
    }

    if (filters?.from) {
      query.andWhere('audit.createdAt >= :from', { from: filters.from });
    }

    if (filters?.to) {
      query.andWhere('audit.createdAt <= :to', { to: filters.to });
    }

    query.orderBy('audit.createdAt', 'DESC');

    const skip = (page - 1) * limit;
    query.skip(skip).take(limit);

    const [data, total] = await query.getManyAndCount();

    return { data, total };
  }
}
