import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { CreateMunicipalityDto } from './dto/create-municipality.dto';
import { UpdateMunicipalityDto } from './dto/update-municipality.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { CreateHospitalDto } from './dto/create-hospital.dto';
import { UpdateHospitalDto } from './dto/update-hospital.dto';
import { CreateHotelDto } from './dto/create-hotel.dto';
import { UpdateHotelDto } from './dto/update-hotel.dto';
import { CreateSpecialtyDto } from './dto/create-specialty.dto';
import { UpdateSpecialtyDto } from './dto/update-specialty.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  DoctorEntity,
  HospitalEntity,
  HotelEntity,
  MunicipalityEntity,
  OrganizationEntity,
  PrincipalEntity,
  SpecialtyEntity,
} from '../entities';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('municipalities')
  findAllMunicipalities(): Promise<MunicipalityEntity[]> {
    return this.adminService.findAllMunicipalities();
  }

  @Get('municipalities/:id')
  findMunicipality(@Param('id') id: string): Promise<MunicipalityEntity> {
    return this.adminService.findMunicipalityById(id);
  }

  @Post('municipalities')
  @HttpCode(HttpStatus.CREATED)
  createMunicipality(
    @Body() dto: CreateMunicipalityDto,
  ): Promise<{ municipality: MunicipalityEntity; otpCode: string }> {
    return this.adminService.createMunicipalityWithAdmin(dto);
  }

  @Patch('municipalities/:id')
  @HttpCode(HttpStatus.OK)
  updateMunicipality(
    @Param('id') id: string,
    @Body() dto: UpdateMunicipalityDto,
  ): Promise<MunicipalityEntity> {
    return this.adminService.updateMunicipality(id, dto);
  }

  @Get('hospitals')
  findAllHospitals(): Promise<HospitalEntity[]> {
    return this.adminService.findAllHospitals();
  }

  @Post('hospitals')
  @HttpCode(HttpStatus.CREATED)
  createHospital(@Body() dto: CreateHospitalDto): Promise<HospitalEntity> {
    return this.adminService.createHospital(dto);
  }

  @Patch('hospitals/:id')
  @HttpCode(HttpStatus.OK)
  updateHospital(
    @Param('id') id: string,
    @Body() dto: UpdateHospitalDto,
  ): Promise<HospitalEntity> {
    return this.adminService.updateHospital(id, dto);
  }

  @Get('hotels')
  findAllHotels(): Promise<HotelEntity[]> {
    return this.adminService.findAllHotels();
  }

  @Post('hotels')
  @HttpCode(HttpStatus.CREATED)
  createHotel(@Body() dto: CreateHotelDto): Promise<HotelEntity> {
    return this.adminService.createHotel(dto);
  }

  @Patch('hotels/:id')
  @HttpCode(HttpStatus.OK)
  updateHotel(
    @Param('id') id: string,
    @Body() dto: UpdateHotelDto,
  ): Promise<HotelEntity> {
    return this.adminService.updateHotel(id, dto);
  }

  @Get('organizations')
  findAllOrganizations(): Promise<OrganizationEntity[]> {
    return this.adminService.findAllOrganizations();
  }

  @Post('organizations')
  @HttpCode(HttpStatus.CREATED)
  createOrganization(
    @Body() dto: CreateOrganizationDto,
  ): Promise<OrganizationEntity> {
    return this.adminService.createOrganization(dto);
  }

  @Patch('organizations/:id')
  @HttpCode(HttpStatus.OK)
  updateOrganization(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
  ): Promise<OrganizationEntity> {
    return this.adminService.updateOrganization(id, dto);
  }

  @Get('users')
  findAllUsers(): Promise<PrincipalEntity[]> {
    return this.adminService.findAllUsers();
  }

  @Post('users')
  @HttpCode(HttpStatus.CREATED)
  createUser(
    @Body() dto: CreateUserDto,
  ): Promise<{ user: PrincipalEntity; otpCode: string }> {
    return this.adminService.createUser(dto);
  }

  @Patch('users/:id')
  @HttpCode(HttpStatus.OK)
  updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<PrincipalEntity> {
    return this.adminService.updateUser(id, dto);
  }

  // ─── Specialties ────────────────────────────────────────────────────────────

  @Get('specialties')
  @Roles('super_admin', 'admin_municipality')
  findAllSpecialties(): Promise<SpecialtyEntity[]> {
    return this.adminService.findAllSpecialties();
  }

  @Post('specialties')
  @HttpCode(HttpStatus.CREATED)
  createSpecialty(@Body() dto: CreateSpecialtyDto): Promise<SpecialtyEntity> {
    return this.adminService.createSpecialty(dto);
  }

  @Patch('specialties/:id')
  @HttpCode(HttpStatus.OK)
  updateSpecialty(
    @Param('id') id: string,
    @Body() dto: UpdateSpecialtyDto,
  ): Promise<SpecialtyEntity> {
    return this.adminService.updateSpecialty(id, dto);
  }

  // ─── Hospital ↔ Specialty ──────────────────────────────────────────────────

  @Get('hospitals/:id/specialties')
  @Roles('super_admin', 'admin_municipality')
  getHospitalSpecialties(@Param('id') id: string): Promise<HospitalEntity> {
    return this.adminService.findHospitalWithSpecialties(id);
  }

  @Post('hospitals/:id/specialties/:specialtyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('super_admin', 'admin_municipality')
  addSpecialtyToHospital(
    @Param('id') id: string,
    @Param('specialtyId') specialtyId: string,
  ): Promise<void> {
    return this.adminService.addSpecialtyToHospital(id, specialtyId);
  }

  @Delete('hospitals/:id/specialties/:specialtyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('super_admin', 'admin_municipality')
  removeSpecialtyFromHospital(
    @Param('id') id: string,
    @Param('specialtyId') specialtyId: string,
  ): Promise<void> {
    return this.adminService.removeSpecialtyFromHospital(id, specialtyId);
  }

  // ─── Doctors ─────────────────────────────────────────────────────────────

  @Get('doctors')
  @Roles('super_admin', 'admin_municipality')
  findAllDoctors(): Promise<DoctorEntity[]> {
    return this.adminService.findAllDoctors();
  }

  @Post('doctors/:id/specialties/:specialtyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('super_admin', 'admin_municipality')
  addSpecialtyToDoctor(
    @Param('id') id: string,
    @Param('specialtyId') specialtyId: string,
  ): Promise<void> {
    return this.adminService.addSpecialtyToDoctor(id, specialtyId);
  }

  @Delete('doctors/:id/specialties/:specialtyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('super_admin', 'admin_municipality')
  removeSpecialtyFromDoctor(
    @Param('id') id: string,
    @Param('specialtyId') specialtyId: string,
  ): Promise<void> {
    return this.adminService.removeSpecialtyFromDoctor(id, specialtyId);
  }
}
