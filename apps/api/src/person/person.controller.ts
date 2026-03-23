import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PersonService } from './person.service';
import { CreatePersonDto } from './dto/create-person.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { PersonEntity } from '../entities';

@Controller('persons')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PersonController {
  constructor(private readonly personService: PersonService) {}

  @Get('search')
  @Permissions('person:read')
  async search(
    @Query('cpf') cpf?: string,
    @Query('sus') sus?: string,
  ): Promise<PersonEntity | null> {
    if (cpf) {
      return this.personService.searchByCpf(cpf);
    }

    if (sus) {
      return this.personService.searchBySusCard(sus);
    }

    throw new BadRequestException(
      'Either cpf or sus query parameter is required',
    );
  }

  @Post()
  @Permissions('person:create')
  async create(@Body() dto: CreatePersonDto): Promise<PersonEntity> {
    return this.personService.create(dto);
  }

  @Get(':id')
  @Permissions('person:read')
  async findById(@Param('id', ParseUUIDPipe) id: string): Promise<PersonEntity> {
    return this.personService.findById(id);
  }
}
