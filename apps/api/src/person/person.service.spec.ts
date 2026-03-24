import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { PersonService } from './person.service';
import {
  PersonEntity,
  PersonIdentificationEntity,
  ContactEntity,
  AddressEntity,
} from '../entities';
import { Gender, ContactType } from '@govmunicipio/shared';

// ── Helpers ──────────────────────────────────────────────────────────────────

const makePerson = (overrides: Partial<PersonEntity> = {}): PersonEntity =>
  ({
    id: 'person-uuid-1',
    firstName: 'Maria',
    lastName: 'Silva',
    gender: Gender.FEMALE,
    identification: {
      id: 'ident-uuid-1',
      cpf: '52998224725',
      susCardNumber: '123456789012345',
      dateOfBirth: new Date('1990-05-15'),
    },
    addressLinks: [],
    contactLinks: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  }) as unknown as PersonEntity;

describe('PersonService', () => {
  let service: PersonService;
  let personRepository: jest.Mocked<Partial<Repository<PersonEntity>>>;
  let identificationRepository: jest.Mocked<Partial<Repository<PersonIdentificationEntity>>>;
  let contactRepository: jest.Mocked<Partial<Repository<ContactEntity>>>;
  let addressRepository: jest.Mocked<Partial<Repository<AddressEntity>>>;
  let dataSource: jest.Mocked<Partial<DataSource>>;

  beforeEach(async () => {
    personRepository = {
      findOne: jest.fn(),
    };

    identificationRepository = {};
    contactRepository = {};
    addressRepository = {};

    dataSource = {
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PersonService,
        { provide: getRepositoryToken(PersonEntity), useValue: personRepository },
        { provide: getRepositoryToken(PersonIdentificationEntity), useValue: identificationRepository },
        { provide: getRepositoryToken(ContactEntity), useValue: contactRepository },
        { provide: getRepositoryToken(AddressEntity), useValue: addressRepository },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<PersonService>(PersonService);
  });

  // ── searchByCpf ────────────────────────────────────────────────────────────

  describe('searchByCpf', () => {
    it('should return a person when CPF is found', async () => {
      const person = makePerson();
      personRepository.findOne!.mockResolvedValue(person);

      const result = await service.searchByCpf('52998224725');

      expect(result).toEqual(person);
      expect(personRepository.findOne).toHaveBeenCalledWith({
        where: { identification: { cpf: '52998224725' } },
        relations: {
          identification: true,
          addressLinks: { address: true },
          contactLinks: { contact: true },
        },
      });
    });

    it('should return null when CPF is not found', async () => {
      personRepository.findOne!.mockResolvedValue(null);

      const result = await service.searchByCpf('00000000191');

      expect(result).toBeNull();
    });

    it('should pass empty string through to the repository', async () => {
      personRepository.findOne!.mockResolvedValue(null);

      const result = await service.searchByCpf('');

      expect(result).toBeNull();
      expect(personRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { identification: { cpf: '' } },
        }),
      );
    });

    it('should handle formatted CPF (passes as-is to repository)', async () => {
      personRepository.findOne!.mockResolvedValue(null);

      await service.searchByCpf('529.982.247-25');

      expect(personRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { identification: { cpf: '529.982.247-25' } },
        }),
      );
    });
  });

  // ── searchBySusCard ────────────────────────────────────────────────────────

  describe('searchBySusCard', () => {
    it('should return a person when SUS card is found', async () => {
      const person = makePerson();
      personRepository.findOne!.mockResolvedValue(person);

      const result = await service.searchBySusCard('123456789012345');

      expect(result).toEqual(person);
      expect(personRepository.findOne).toHaveBeenCalledWith({
        where: { identification: { susCardNumber: '123456789012345' } },
        relations: {
          identification: true,
          addressLinks: { address: true },
          contactLinks: { contact: true },
        },
      });
    });

    it('should return null when SUS card is not found', async () => {
      personRepository.findOne!.mockResolvedValue(null);

      const result = await service.searchBySusCard('999999999999999');

      expect(result).toBeNull();
    });

    it('should pass empty string through to the repository', async () => {
      personRepository.findOne!.mockResolvedValue(null);

      const result = await service.searchBySusCard('');

      expect(result).toBeNull();
    });
  });

  // ── findById ───────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('should return a person when found by id', async () => {
      const person = makePerson();
      personRepository.findOne!.mockResolvedValue(person);

      const result = await service.findById('person-uuid-1');

      expect(result).toEqual(person);
      expect(personRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'person-uuid-1' },
        relations: {
          identification: true,
          addressLinks: { address: true },
          contactLinks: { contact: true },
        },
      });
    });

    it('should throw NotFoundException when person is not found', async () => {
      personRepository.findOne!.mockResolvedValue(null);

      await expect(service.findById('nonexistent-uuid')).rejects.toThrow(NotFoundException);
      await expect(service.findById('nonexistent-uuid')).rejects.toThrow(
        'Person with id nonexistent-uuid not found',
      );
    });
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create a person with minimal data (no address, no contacts)', async () => {
      const expectedPerson = makePerson();

      // The transaction callback receives a manager — we simulate it by invoking the callback
      dataSource.transaction!.mockImplementation(async (cb: any) => {
        const manager = {
          create: jest.fn().mockImplementation((_Entity: any, data: any) => data),
          save: jest.fn().mockImplementation(async (_Entity: any, data: any) => ({
            id: 'person-uuid-1',
            ...data,
          })),
          findOneOrFail: jest.fn().mockResolvedValue(expectedPerson),
        };
        return cb(manager);
      });

      const dto = {
        firstName: 'Maria',
        lastName: 'Silva',
        gender: Gender.FEMALE,
        cpf: '52998224725',
        dateOfBirth: '1990-05-15',
      };

      const result = await service.create(dto);

      expect(result).toEqual(expectedPerson);
      expect(dataSource.transaction).toHaveBeenCalled();
    });

    it('should create a person with address and contacts', async () => {
      const expectedPerson = makePerson({
        addressLinks: [{ address: { street: 'Rua A' } }] as any,
        contactLinks: [{ contact: { type: ContactType.PHONE, value: '11999998888' } }] as any,
      });

      dataSource.transaction!.mockImplementation(async (cb: any) => {
        const manager = {
          create: jest.fn().mockImplementation((_Entity: any, data: any) => data),
          save: jest.fn().mockImplementation(async (_Entity: any, data: any) => ({
            id: 'new-uuid',
            ...data,
          })),
          findOneOrFail: jest.fn().mockResolvedValue(expectedPerson),
        };
        return cb(manager);
      });

      const dto = {
        firstName: 'Maria',
        lastName: 'Silva',
        gender: Gender.FEMALE,
        cpf: '52998224725',
        dateOfBirth: '1990-05-15',
        address: {
          street: 'Rua A',
          number: '100',
          neighborhood: 'Centro',
          city: 'Sao Paulo',
          state: 'SP',
          zipCode: '01000000',
        },
        contacts: [
          { type: ContactType.PHONE, value: '11999998888' },
        ],
      };

      const result = await service.create(dto);

      expect(result).toEqual(expectedPerson);
      expect(dataSource.transaction).toHaveBeenCalled();
    });
  });
});
