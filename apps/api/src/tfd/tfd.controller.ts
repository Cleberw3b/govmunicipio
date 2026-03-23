import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  ParseUUIDPipe,
  Res,
} from '@nestjs/common';

interface Response {
  set(headers: Record<string, string>): void;
  end(data: Buffer): void;
}
import { TfdService } from './tfd.service';
import { TfdPdfService } from './tfd-pdf.service';
import { CreateTfdRequestDto } from './dto/create-tfd-request.dto';
import { UpdateTfdRequestDto } from './dto/update-tfd-request.dto';
import { UpdateTfdStatusDto } from './dto/update-tfd-status.dto';
import { UpdateTfdCostsDto } from './dto/update-tfd-costs.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import {
  CurrentPrincipal,
  CurrentPrincipalData,
} from '../auth/decorators/current-principal.decorator';
import { TfdRequestEntity, StatusEntity } from '../entities';
import { PaginationQueryDto } from '../common';
import { IPaginatedResponse } from '@govmunicipio/shared';

interface TfdStats {
  total: number;
  pending: number;
  inTransit: number;
  thisMonth: number;
  monthlySpending: number;
  averagePerPatient: number;
}

@Controller('tfd/requests')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TfdController {
  constructor(
    private readonly tfdService: TfdService,
    private readonly tfdPdfService: TfdPdfService,
  ) {}

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
    @Query() paginationDto: PaginationQueryDto,
    @CurrentPrincipal() principal: CurrentPrincipalData,
  ): Promise<IPaginatedResponse<TfdRequestEntity>> {
    return this.tfdService.findAll(
      principal.organizationId,
      statusFilter,
      paginationDto.page || 1,
      paginationDto.limit || 20,
    );
  }

  @Get('stats')
  @Permissions('tfd_request:read')
  async getStats(
    @CurrentPrincipal() principal: CurrentPrincipalData,
  ): Promise<TfdStats> {
    return this.tfdService.getStats(principal.organizationId);
  }

  @Get('statuses')
  @Permissions('tfd_request:read')
  async findStatuses(): Promise<StatusEntity[]> {
    return this.tfdService.findStatuses();
  }

  @Get(':id')
  @Permissions('tfd_request:read')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentPrincipal() principal: CurrentPrincipalData,
  ): Promise<TfdRequestEntity> {
    return this.tfdService.findOne(id, principal.organizationId);
  }

  @Patch(':id')
  @Permissions('tfd_request:update')
  async updateRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTfdRequestDto,
    @CurrentPrincipal() principal: CurrentPrincipalData,
  ): Promise<TfdRequestEntity> {
    return this.tfdService.updateRequest(id, dto, principal.organizationId);
  }

  @Post(':id/submit')
  @Permissions('tfd_request:update')
  async submit(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentPrincipal() principal: CurrentPrincipalData,
  ): Promise<TfdRequestEntity> {
    return this.tfdService.submit(id, principal.organizationId);
  }

  @Patch(':id/costs')
  @Permissions('tfd_request:update')
  async updateCosts(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTfdCostsDto,
    @CurrentPrincipal() principal: CurrentPrincipalData,
  ): Promise<TfdRequestEntity> {
    return this.tfdService.updateCosts(id, dto, principal.organizationId);
  }

  @Patch(':id/status')
  @Permissions('tfd_request:update')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTfdStatusDto,
    @CurrentPrincipal() principal: CurrentPrincipalData,
  ): Promise<TfdRequestEntity> {
    return this.tfdService.updateStatus(
      id,
      dto.statusCode,
      principal.organizationId,
    );
  }

  @Get(':id/pdf')
  @Permissions('tfd_request:read')
  async generatePdf(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentPrincipal() principal: CurrentPrincipalData,
    @Res() res: Response,
  ): Promise<void> {
    const tfdRequest = await this.tfdService.findOne(id, principal.organizationId);
    const pdfBuffer = await this.tfdPdfService.generatePdf(tfdRequest);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="TFD-${tfdRequest.protocolNumber}.pdf"`,
      'Content-Length': pdfBuffer.length.toString(),
    });
    res.end(pdfBuffer);
  }
}
