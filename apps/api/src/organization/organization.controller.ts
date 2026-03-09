import { Controller, Get, Post, Query, Body, UseGuards } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { HospitalEntity, DoctorEntity, SpecialtyEntity } from '../entities';
import { CreateDoctorDto } from './dto/create-doctor.dto';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get('hospitals')
  async findHospitals(): Promise<HospitalEntity[]> {
    return this.organizationService.findHospitals();
  }

  @Get('doctors/search')
  @Permissions('person:read')
  async searchDoctors(
    @Query('q') q: string,
  ): Promise<DoctorEntity[]> {
    return this.organizationService.searchDoctors(q ?? '');
  }

  @Post('doctors')
  @Permissions('person:create')
  async createDoctor(@Body() dto: CreateDoctorDto): Promise<DoctorEntity> {
    return this.organizationService.createDoctor(dto);
  }

  @Get('doctors')
  async findDoctors(): Promise<DoctorEntity[]> {
    return this.organizationService.findDoctors();
  }

  @Get('specialties')
  async findSpecialties(): Promise<SpecialtyEntity[]> {
    return this.organizationService.findSpecialties();
  }
}
