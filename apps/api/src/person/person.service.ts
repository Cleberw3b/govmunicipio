import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  PersonEntity,
  PersonIdentificationEntity,
  ContactEntity,
  AddressEntity,
} from '../entities';
import { CreatePersonDto } from './dto/create-person.dto';

@Injectable()
export class PersonService {
  constructor(
    @InjectRepository(PersonEntity)
    private readonly personRepository: Repository<PersonEntity>,
    @InjectRepository(PersonIdentificationEntity)
    private readonly identificationRepository: Repository<PersonIdentificationEntity>,
    @InjectRepository(ContactEntity)
    private readonly contactRepository: Repository<ContactEntity>,
    @InjectRepository(AddressEntity)
    private readonly addressRepository: Repository<AddressEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async searchByCpf(cpf: string): Promise<PersonEntity | null> {
    return this.personRepository.findOne({
      where: { identification: { cpf } },
      relations: {
        identification: true,
        address: true,
        contacts: true,
      },
    });
  }

  async searchBySusCard(susCardNumber: string): Promise<PersonEntity | null> {
    return this.personRepository.findOne({
      where: { identification: { susCardNumber } },
      relations: {
        identification: true,
        address: true,
        contacts: true,
      },
    });
  }

  async findById(id: string): Promise<PersonEntity> {
    const person = await this.personRepository.findOne({
      where: { id },
      relations: {
        identification: true,
        address: true,
        contacts: true,
      },
    });

    if (!person) {
      throw new NotFoundException(`Person with id ${id} not found`);
    }

    return person;
  }

  async create(dto: CreatePersonDto): Promise<PersonEntity> {
    return this.dataSource.transaction(async (manager) => {
      let address: AddressEntity | null = null;

      if (dto.address) {
        const addressEntity = manager.create(AddressEntity, {
          street: dto.address.street,
          number: dto.address.number,
          complement: dto.address.complement ?? null,
          neighborhood: dto.address.neighborhood,
          city: dto.address.city,
          state: dto.address.state,
          zipCode: dto.address.zipCode,
        });
        address = await manager.save(AddressEntity, addressEntity);
      }

      const contacts: ContactEntity[] = [];

      if (dto.contacts && dto.contacts.length > 0) {
        for (const contactDto of dto.contacts) {
          const contactEntity = manager.create(ContactEntity, {
            type: contactDto.type,
            value: contactDto.value,
            label: contactDto.label ?? null,
            isPrimary: contactDto.isPrimary ?? false,
          });
          const savedContact = await manager.save(ContactEntity, contactEntity);
          contacts.push(savedContact);
        }
      }

      const personEntity = manager.create(PersonEntity, {
        firstName: dto.firstName,
        lastName: dto.lastName,
        gender: dto.gender,
        address,
        contacts,
      });
      const person = await manager.save(PersonEntity, personEntity);

      const identificationEntity = manager.create(PersonIdentificationEntity, {
        cpf: dto.cpf,
        rg: dto.rg ?? null,
        susCardNumber: dto.susCardNumber ?? null,
        dateOfBirth: dto.dateOfBirth as unknown as Date,
        issuingAuthority: dto.issuingAuthority ?? null,
        person,
      });
      await manager.save(PersonIdentificationEntity, identificationEntity);

      return this.personRepository.findOneOrFail({
        where: { id: person.id },
        relations: {
          identification: true,
          address: true,
          contacts: true,
        },
      });
    });
  }
}
