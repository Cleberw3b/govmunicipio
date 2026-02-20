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
import { AdminService } from './admin.service';
import { CreateMunicipalityDto } from './dto/create-municipality.dto';
import { UpdateMunicipalityDto } from './dto/update-municipality.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { MunicipalityEntity, PrincipalEntity } from '../entities';

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
  ): Promise<MunicipalityEntity> {
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

  @Get('users')
  findAllUsers(): Promise<PrincipalEntity[]> {
    return this.adminService.findAllUsers();
  }

  @Patch('users/:id')
  @HttpCode(HttpStatus.OK)
  updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<PrincipalEntity> {
    return this.adminService.updateUser(id, dto);
  }
}
