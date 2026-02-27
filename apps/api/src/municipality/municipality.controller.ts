import {
  Controller,
  Get,
  Post,
  Delete,
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
import { CreateMunicipalityHospitalDto } from './dto/create-hospital.dto';
import { CreateHotelDto } from './dto/create-hotel.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  CurrentPrincipal,
  CurrentPrincipalData,
} from '../auth/decorators/current-principal.decorator';
import { HospitalEntity, HotelEntity, OrganizationEntity, PrincipalEntity } from '../entities';

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
  ): Promise<{ user: PrincipalEntity; otpCode: string }> {
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

  // ─── Hospitals ─────────────────────────────────────────────────────────────

  @Get('hospitals')
  findLinkedHospitals(@CurrentPrincipal() p: CurrentPrincipalData): Promise<HospitalEntity[]> {
    return this.municipalityService.findLinkedHospitals(p.organizationId);
  }

  @Post('hospitals')
  @HttpCode(HttpStatus.CREATED)
  createHospital(
    @Body() dto: CreateMunicipalityHospitalDto,
    @CurrentPrincipal() p: CurrentPrincipalData,
  ): Promise<HospitalEntity> {
    return this.municipalityService.createHospital(dto, p.organizationId);
  }

  @Get('hospitals/available')
  findAvailableHospitals(@CurrentPrincipal() p: CurrentPrincipalData): Promise<HospitalEntity[]> {
    return this.municipalityService.findAvailableHospitals(p.organizationId);
  }

  @Post('hospitals/:hospitalId/link')
  @HttpCode(HttpStatus.NO_CONTENT)
  linkHospital(
    @Param('hospitalId') hospitalId: string,
    @CurrentPrincipal() p: CurrentPrincipalData,
  ): Promise<void> {
    return this.municipalityService.linkHospital(hospitalId, p.organizationId);
  }

  @Delete('hospitals/:hospitalId/link')
  @HttpCode(HttpStatus.NO_CONTENT)
  unlinkHospital(
    @Param('hospitalId') hospitalId: string,
    @CurrentPrincipal() p: CurrentPrincipalData,
  ): Promise<void> {
    return this.municipalityService.unlinkHospital(hospitalId, p.organizationId);
  }

  // ─── Hotels ────────────────────────────────────────────────────────────────

  @Get('hotels')
  findLinkedHotels(@CurrentPrincipal() p: CurrentPrincipalData): Promise<HotelEntity[]> {
    return this.municipalityService.findLinkedHotels(p.organizationId);
  }

  @Post('hotels')
  @HttpCode(HttpStatus.CREATED)
  createHotel(
    @Body() dto: CreateHotelDto,
    @CurrentPrincipal() p: CurrentPrincipalData,
  ): Promise<HotelEntity> {
    return this.municipalityService.createHotel(dto, p.organizationId);
  }

  @Get('hotels/available')
  findAvailableHotels(@CurrentPrincipal() p: CurrentPrincipalData): Promise<HotelEntity[]> {
    return this.municipalityService.findAvailableHotels(p.organizationId);
  }

  @Post('hotels/:hotelId/link')
  @HttpCode(HttpStatus.NO_CONTENT)
  linkHotel(
    @Param('hotelId') hotelId: string,
    @CurrentPrincipal() p: CurrentPrincipalData,
  ): Promise<void> {
    return this.municipalityService.linkHotel(hotelId, p.organizationId);
  }

  @Delete('hotels/:hotelId/link')
  @HttpCode(HttpStatus.NO_CONTENT)
  unlinkHotel(
    @Param('hotelId') hotelId: string,
    @CurrentPrincipal() p: CurrentPrincipalData,
  ): Promise<void> {
    return this.municipalityService.unlinkHotel(hotelId, p.organizationId);
  }
}
