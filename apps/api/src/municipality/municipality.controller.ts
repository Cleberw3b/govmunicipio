import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MunicipalityService } from './municipality.service';
import { CreateMunicipalityUserDto } from './dto/create-municipality-user.dto';
import { UpdateMunicipalityUserDto } from './dto/update-municipality-user.dto';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  CurrentPrincipal,
  CurrentPrincipalData,
} from '../auth/decorators/current-principal.decorator';
import { OrganizationEntity, PrincipalEntity } from '../entities';

@Controller('municipality')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin_municipality')
export class MunicipalityController {
  constructor(private readonly municipalityService: MunicipalityService) {}

  @Get('users')
  findUsers(@CurrentPrincipal() p: CurrentPrincipalData): Promise<PrincipalEntity[]> {
    return this.municipalityService.findUsers(p.organizationId);
  }

  @Post('users')
  @HttpCode(HttpStatus.CREATED)
  createUser(
    @Body() dto: CreateMunicipalityUserDto,
    @CurrentPrincipal() p: CurrentPrincipalData,
  ): Promise<PrincipalEntity> {
    return this.municipalityService.createUser(dto, p.organizationId);
  }

  @Patch('users/:id')
  @HttpCode(HttpStatus.OK)
  updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateMunicipalityUserDto,
    @CurrentPrincipal() p: CurrentPrincipalData,
  ): Promise<PrincipalEntity> {
    return this.municipalityService.updateUser(id, dto, p.organizationId);
  }

  @Get('organizations')
  findOrganizations(): Promise<OrganizationEntity[]> {
    return this.municipalityService.findOrganizations();
  }

  @Post('organizations')
  @HttpCode(HttpStatus.CREATED)
  createOrganization(
    @Body() dto: CreateOrganizationDto,
  ): Promise<OrganizationEntity> {
    return this.municipalityService.createOrganization(dto);
  }
}
