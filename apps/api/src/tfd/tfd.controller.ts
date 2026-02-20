import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { TfdService } from './tfd.service';
import { CreateTfdRequestDto } from './dto/create-tfd-request.dto';
import { UpdateTfdStatusDto } from './dto/update-tfd-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import {
  CurrentPrincipal,
  CurrentPrincipalData,
} from '../auth/decorators/current-principal.decorator';
import { TfdRequestEntity } from '../entities';

interface TfdStats {
  total: number;
  pending: number;
  approved: number;
  thisMonth: number;
}

@Controller('tfd/requests')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TfdController {
  constructor(private readonly tfdService: TfdService) {}

  @Post()
  @Permissions('tfd_request:create')
  async create(
    @Body() dto: CreateTfdRequestDto,
    @CurrentPrincipal() principal: CurrentPrincipalData,
  ): Promise<TfdRequestEntity> {
    return this.tfdService.create(
      dto,
      principal.principalId,
      principal.organizationId,
    );
  }

  @Get()
  @Permissions('tfd_request:read')
  async findAll(
    @Query('status') statusFilter: string | undefined,
    @CurrentPrincipal() principal: CurrentPrincipalData,
  ): Promise<TfdRequestEntity[]> {
    return this.tfdService.findAll(principal.organizationId, statusFilter);
  }

  @Get('stats')
  @Permissions('tfd_request:read')
  async getStats(
    @CurrentPrincipal() principal: CurrentPrincipalData,
  ): Promise<TfdStats> {
    return this.tfdService.getStats(principal.organizationId);
  }

  @Get(':id')
  @Permissions('tfd_request:read')
  async findOne(
    @Param('id') id: string,
    @CurrentPrincipal() principal: CurrentPrincipalData,
  ): Promise<TfdRequestEntity> {
    return this.tfdService.findOne(id, principal.organizationId);
  }

  @Patch(':id/status')
  @Permissions('tfd_request:update')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTfdStatusDto,
    @CurrentPrincipal() principal: CurrentPrincipalData,
  ): Promise<TfdRequestEntity> {
    return this.tfdService.updateStatus(
      id,
      dto.statusId,
      principal.organizationId,
    );
  }
}
