import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CurrentPrincipal, CurrentPrincipalData } from '../auth/decorators/current-principal.decorator';
import { NotificationEntity } from '../entities';

@Controller('notifications')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async list(
    @CurrentPrincipal() principal: CurrentPrincipalData,
  ): Promise<NotificationEntity[]> {
    return this.notificationService.findByRecipient(principal.principalId, 50);
  }

  @Get('unread-count')
  async getUnreadCount(
    @CurrentPrincipal() principal: CurrentPrincipalData,
  ): Promise<{ count: number }> {
    const count = await this.notificationService.getUnreadCount(
      principal.principalId,
    );
    return { count };
  }

  @Patch(':id/read')
  async markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentPrincipal() principal: CurrentPrincipalData,
  ): Promise<NotificationEntity> {
    return this.notificationService.markAsRead(id, principal.principalId);
  }

  @Post('mark-all-read')
  async markAllAsRead(
    @CurrentPrincipal() principal: CurrentPrincipalData,
  ): Promise<void> {
    return this.notificationService.markAllAsRead(principal.principalId);
  }
}
