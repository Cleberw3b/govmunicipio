import { Controller, Get, UseGuards } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { HospitalEntity, DoctorEntity, SpecialtyEntity } from '../entities';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get('hospitals')
  async findHospitals(): Promise<HospitalEntity[]> {
    return this.organizationService.findHospitals();
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
