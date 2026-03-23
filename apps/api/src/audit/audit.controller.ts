import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService, AuditFilters } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuditLogEntity } from '../entities';

@Controller('admin/audit-logs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Roles('super_admin')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async findAll(
    @Query('entityType') entityType?: string,
    @Query('actorId') actorId?: string,
    @Query('action') action?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
  ): Promise<{ data: AuditLogEntity[]; total: number }> {
    const filters: AuditFilters = {};

    if (entityType) filters.entityType = entityType;
    if (actorId) filters.actorId = actorId;
    if (action) filters.action = action;
    if (from) filters.from = new Date(from);
    if (to) filters.to = new Date(to);

    return this.auditService.findAll(
      filters,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }
}
