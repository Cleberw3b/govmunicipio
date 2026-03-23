import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { TfdService } from './tfd.service';
import { TfdRequestEntity, StatusEntity, MunicipalityEntity } from '../entities';
import { OrganizationService } from '../organization/organization.service';
import { WhatsAppService } from './whatsapp.service';
import { CreateTfdRequestDto } from './dto/create-tfd-request.dto';

describe('TfdService', () => {
  let service: TfdService;
  let tfdRepository: Repository<TfdRequestEntity>;
  let statusRepository: Repository<StatusEntity>;
  let municipalityRepository: Repository<MunicipalityEntity>;
  let organizationService: OrganizationService;
  let whatsAppService: WhatsAppService;

  const mockMunicipality = {
    id: 'municipality-1',
    ibgeCode: '3106200',
    state: 'MG',
  };

  const mockDraftStatus = {
    id: 'status-draft',
    code: 'draft',
    label: 'Rascunho',
  };

  const mockPendingStatus = {
    id: 'status-pending',
    code: 'pending',
    label: 'Pendente',
  };

  const mockInTransitStatus = {
    id: 'status-in-transit',
    code: 'in_transit',
    label: 'Em Trânsito',
  };

  const mockFinalizedStatus = {
    id: 'status-finalized',
    code: 'finalized',
    label: 'Finalizado',
  };

  const mockCancelledStatus = {
    id: 'status-cancelled',
    code: 'cancelled',
    label: 'Cancelado',
  };

  const mockTfdRequest = {
    id: 'tfd-1',
    protocolNumber: 'TFD-20260318-123456',
    patientPersonId: 'person-1',
    diagnosisCid: 'A00',
    procedureDescription: 'Cirurgia',
    justification: 'Necessário tratamento',
    requestDate: new Date('2026-03-18'),
    travelDate: new Date('2026-03-20'),
    returnDate: new Date('2026-03-25'),
    transportType: 'ambulância',
    requestingDoctor: { id: 'doctor-1' },
    destinationHospital: { id: 'hospital-1' },
    municipality: mockMunicipality,
    status: mockDraftStatus,
    createdByPrincipal: { id: 'principal-1' },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TfdService,
        {
          provide: getRepositoryToken(TfdRequestEntity),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            findOneOrFail: jest.fn(),
            createQueryBuilder: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(StatusEntity),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(MunicipalityEntity),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: OrganizationService,
          useValue: {
            findMunicipalityByOrganizationId: jest.fn(),
          },
        },
        {
          provide: WhatsAppService,
          useValue: {
            sendTfdNotification: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<TfdService>(TfdService);
    tfdRepository = module.get<Repository<TfdRequestEntity>>(
      getRepositoryToken(TfdRequestEntity),
    );
    statusRepository = module.get<Repository<StatusEntity>>(
      getRepositoryToken(StatusEntity),
    );
    municipalityRepository = module.get<Repository<MunicipalityEntity>>(
      getRepositoryToken(MunicipalityEntity),
    );
    organizationService = module.get<OrganizationService>(OrganizationService);
    whatsAppService = module.get<WhatsAppService>(WhatsAppService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Helper: setup mocks for findOne (used by updateStatus, updateRequest, etc.)
  // -------------------------------------------------------------------------
  function mockFindOne(tfdData: any) {
    (organizationService.findMunicipalityByOrganizationId as jest.Mock).mockResolvedValue(
      mockMunicipality,
    );
    (tfdRepository.findOne as jest.Mock).mockResolvedValue(tfdData);
  }

  // =========================================================================
  // generateProtocolNumber
  // =========================================================================
  describe('generateProtocolNumber', () => {
    it('should generate a protocol number with TFD prefix and date and 6-digit random suffix', () => {
      const result = service['generateProtocolNumber']();
      expect(result).toMatch(/^TFD-\d{8}-\d{6}$/);
    });

    it('should include current date in YYYYMMDD format', () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const expectedDatePart = `${year}${month}${day}`;
      const result = service['generateProtocolNumber']();
      const datePart = result.split('-')[1];
      expect(datePart).toBe(expectedDatePart);
    });
  });

  // =========================================================================
  // create
  // =========================================================================
  describe('create', () => {
    it('should create a draft TFD request with minimal data', async () => {
      const dto: CreateTfdRequestDto = {
        patientPersonId: 'person-1',
        companionPersonId: undefined,
        requestingDoctorId: undefined,
        destinationHospitalId: undefined,
      };

      (organizationService.findMunicipalityByOrganizationId as jest.Mock).mockResolvedValue(
        mockMunicipality,
      );
      (statusRepository.findOne as jest.Mock).mockResolvedValue(mockDraftStatus);
      (tfdRepository.create as jest.Mock).mockReturnValue(mockTfdRequest);
      (tfdRepository.save as jest.Mock).mockResolvedValue(mockTfdRequest);
      (tfdRepository.findOneOrFail as jest.Mock).mockResolvedValue(mockTfdRequest);

      const result = await service.create(dto, 'principal-1', 'org-1');

      expect(result).toEqual(mockTfdRequest);
      expect(tfdRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          protocolNumber: expect.stringMatching(/^TFD-\d{8}-\d{6}$/),
          patientPerson: { id: 'person-1' },
          municipality: { id: mockMunicipality.id },
          status: { id: mockDraftStatus.id },
        }),
      );
    });

    it('should throw NotFoundException when default status (draft) is not found', async () => {
      const dto: CreateTfdRequestDto = {
        patientPersonId: 'person-1',
      };

      (organizationService.findMunicipalityByOrganizationId as jest.Mock).mockResolvedValue(
        mockMunicipality,
      );
      (statusRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.create(dto, 'principal-1', 'org-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // =========================================================================
  // submit (draft → pending)
  // =========================================================================
  describe('submit', () => {
    it('should change status from draft to pending when all required fields are filled', async () => {
      const tfdWithAllFields = {
        ...mockTfdRequest,
        status: mockDraftStatus,
        requestingDoctor: { id: 'doctor-1', person: {} },
        destinationHospital: { id: 'hospital-1' },
        diagnosisCid: 'A00',
        procedureDescription: 'Procedure',
        justification: 'Reason',
        requestDate: new Date(),
        transportType: 'ambulância',
      };

      mockFindOne(tfdWithAllFields);
      (statusRepository.findOne as jest.Mock).mockResolvedValue(mockPendingStatus);
      (tfdRepository.save as jest.Mock).mockResolvedValue(tfdWithAllFields);

      await service.submit('tfd-1', 'org-1');

      expect(tfdRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: mockPendingStatus,
        }),
      );
    });

    it('should throw BadRequestException when request is not in draft status', async () => {
      const pendingRequest = { ...mockTfdRequest, status: mockPendingStatus };
      mockFindOne(pendingRequest);

      await expect(service.submit('tfd-1', 'org-1')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.submit('tfd-1', 'org-1')).rejects.toThrow(
        'Apenas solicitações em rascunho podem ser enviadas.',
      );
    });

    it('should throw BadRequestException when required fields are missing', async () => {
      const incompleteRequest = {
        ...mockTfdRequest,
        status: mockDraftStatus,
        requestingDoctor: null,
      };

      mockFindOne(incompleteRequest);

      await expect(service.submit('tfd-1', 'org-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should call WhatsApp notification service after successful submission', async () => {
      const completeRequest = {
        ...mockTfdRequest,
        status: mockDraftStatus,
        requestingDoctor: { id: 'doctor-1' },
        destinationHospital: { id: 'hospital-1' },
      };

      mockFindOne(completeRequest);
      (statusRepository.findOne as jest.Mock).mockResolvedValue(mockPendingStatus);
      (tfdRepository.save as jest.Mock).mockResolvedValue(completeRequest);

      await service.submit('tfd-1', 'org-1');

      expect(whatsAppService.sendTfdNotification).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // updateStatus — Status transition validation (QA-1)
  // =========================================================================
  describe('updateStatus', () => {
    // Valid transitions
    it('should allow draft → cancelled', async () => {
      mockFindOne({ ...mockTfdRequest, status: mockDraftStatus });
      (statusRepository.findOne as jest.Mock).mockResolvedValue(mockCancelledStatus);
      (tfdRepository.save as jest.Mock).mockResolvedValue({});

      await expect(service.updateStatus('tfd-1', 'cancelled', 'org-1')).resolves.toBeDefined();
    });

    it('should allow pending → in_transit', async () => {
      mockFindOne({ ...mockTfdRequest, status: mockPendingStatus });
      (statusRepository.findOne as jest.Mock).mockResolvedValue(mockInTransitStatus);
      (tfdRepository.save as jest.Mock).mockResolvedValue({});

      await expect(service.updateStatus('tfd-1', 'in_transit', 'org-1')).resolves.toBeDefined();
    });

    it('should allow pending → cancelled', async () => {
      mockFindOne({ ...mockTfdRequest, status: mockPendingStatus });
      (statusRepository.findOne as jest.Mock).mockResolvedValue(mockCancelledStatus);
      (tfdRepository.save as jest.Mock).mockResolvedValue({});

      await expect(service.updateStatus('tfd-1', 'cancelled', 'org-1')).resolves.toBeDefined();
    });

    it('should allow in_transit → finalized', async () => {
      mockFindOne({ ...mockTfdRequest, status: mockInTransitStatus });
      (statusRepository.findOne as jest.Mock).mockResolvedValue(mockFinalizedStatus);
      (tfdRepository.save as jest.Mock).mockResolvedValue({});

      await expect(service.updateStatus('tfd-1', 'finalized', 'org-1')).resolves.toBeDefined();
    });

    it('should allow in_transit → cancelled', async () => {
      mockFindOne({ ...mockTfdRequest, status: mockInTransitStatus });
      (statusRepository.findOne as jest.Mock).mockResolvedValue(mockCancelledStatus);
      (tfdRepository.save as jest.Mock).mockResolvedValue({});

      await expect(service.updateStatus('tfd-1', 'cancelled', 'org-1')).resolves.toBeDefined();
    });

    // Invalid transitions
    it('should reject draft → in_transit', async () => {
      mockFindOne({ ...mockTfdRequest, status: mockDraftStatus });

      await expect(service.updateStatus('tfd-1', 'in_transit', 'org-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject draft → finalized', async () => {
      mockFindOne({ ...mockTfdRequest, status: mockDraftStatus });

      await expect(service.updateStatus('tfd-1', 'finalized', 'org-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject pending → draft', async () => {
      mockFindOne({ ...mockTfdRequest, status: mockPendingStatus });

      await expect(service.updateStatus('tfd-1', 'draft', 'org-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject pending → finalized', async () => {
      mockFindOne({ ...mockTfdRequest, status: mockPendingStatus });

      await expect(service.updateStatus('tfd-1', 'finalized', 'org-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject in_transit → pending', async () => {
      mockFindOne({ ...mockTfdRequest, status: mockInTransitStatus });

      await expect(service.updateStatus('tfd-1', 'pending', 'org-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject in_transit → draft', async () => {
      mockFindOne({ ...mockTfdRequest, status: mockInTransitStatus });

      await expect(service.updateStatus('tfd-1', 'draft', 'org-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject any transition from finalized (terminal state)', async () => {
      mockFindOne({ ...mockTfdRequest, status: mockFinalizedStatus });

      await expect(service.updateStatus('tfd-1', 'pending', 'org-1')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.updateStatus('tfd-1', 'draft', 'org-1')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.updateStatus('tfd-1', 'cancelled', 'org-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject any transition from cancelled (terminal state)', async () => {
      mockFindOne({ ...mockTfdRequest, status: mockCancelledStatus });

      await expect(service.updateStatus('tfd-1', 'pending', 'org-1')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.updateStatus('tfd-1', 'draft', 'org-1')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.updateStatus('tfd-1', 'in_transit', 'org-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should include current and target status in error message', async () => {
      mockFindOne({ ...mockTfdRequest, status: mockDraftStatus });

      await expect(service.updateStatus('tfd-1', 'finalized', 'org-1')).rejects.toThrow(
        /draft.*finalized/,
      );
    });
  });

  // =========================================================================
  // updateRequest — Partial edit rules (QA-2)
  // =========================================================================
  describe('updateRequest', () => {
    it('should allow editing all fields when status is draft', async () => {
      const draftRequest = { ...mockTfdRequest, status: mockDraftStatus };
      mockFindOne(draftRequest);
      (tfdRepository.save as jest.Mock).mockResolvedValue(draftRequest);

      await expect(
        service.updateRequest('tfd-1', { diagnosisCid: 'B01', notes: 'test' }, 'org-1'),
      ).resolves.toBeDefined();
    });

    it('should allow editing travel/cost/notes fields when status is pending', async () => {
      const pendingRequest = { ...mockTfdRequest, status: mockPendingStatus };
      mockFindOne(pendingRequest);
      (tfdRepository.save as jest.Mock).mockResolvedValue(pendingRequest);

      await expect(
        service.updateRequest(
          'tfd-1',
          {
            travelDate: '2026-04-01' as any,
            transportationCost: 500,
            foodCost: 100,
            hotelCost: 200,
            notes: 'Updated notes',
          },
          'org-1',
        ),
      ).resolves.toBeDefined();
    });

    it('should reject editing clinical fields when status is pending', async () => {
      const pendingRequest = { ...mockTfdRequest, status: mockPendingStatus };
      mockFindOne(pendingRequest);

      await expect(
        service.updateRequest('tfd-1', { diagnosisCid: 'B01' }, 'org-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject editing patient/doctor fields when status is pending', async () => {
      const pendingRequest = { ...mockTfdRequest, status: mockPendingStatus };
      mockFindOne(pendingRequest);

      await expect(
        service.updateRequest('tfd-1', { requestingDoctorId: 'doctor-2' }, 'org-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject editing any field when status is in_transit', async () => {
      const inTransitRequest = { ...mockTfdRequest, status: mockInTransitStatus };
      mockFindOne(inTransitRequest);

      await expect(
        service.updateRequest('tfd-1', { notes: 'Updated' }, 'org-1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateRequest('tfd-1', { notes: 'Updated' }, 'org-1'),
      ).rejects.toThrow('Solicitação não pode ser editada neste status.');
    });

    it('should reject editing any field when status is finalized', async () => {
      const finalizedRequest = { ...mockTfdRequest, status: mockFinalizedStatus };
      mockFindOne(finalizedRequest);

      await expect(
        service.updateRequest('tfd-1', { notes: 'Updated' }, 'org-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject editing any field when status is cancelled', async () => {
      const cancelledRequest = { ...mockTfdRequest, status: mockCancelledStatus };
      mockFindOne(cancelledRequest);

      await expect(
        service.updateRequest('tfd-1', { notes: 'Updated' }, 'org-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // getStats (QA-8) — updated to use inTransit instead of approved
  // =========================================================================
  describe('getStats', () => {
    it('should return statistics with inTransit count for a municipality', async () => {
      (organizationService.findMunicipalityByOrganizationId as jest.Mock).mockResolvedValue(
        mockMunicipality,
      );
      (tfdRepository.count as jest.Mock)
        .mockResolvedValueOnce(50)  // total
        .mockResolvedValueOnce(10)  // pending
        .mockResolvedValueOnce(8);  // inTransit

      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(15),
      };
      (tfdRepository.createQueryBuilder as jest.Mock)
        .mockReturnValueOnce(queryBuilder)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getRawOne: jest.fn().mockResolvedValue({ total: '5000.00' }),
        });

      const result = await service.getStats('org-1');

      expect(result).toEqual({
        total: 50,
        pending: 10,
        inTransit: 8,
        thisMonth: 15,
        monthlySpending: 5000.00,
        averagePerPatient: 5000.00 / 15,
      });
    });

    it('should calculate averagePerPatient as 0 when thisMonth is 0', async () => {
      (organizationService.findMunicipalityByOrganizationId as jest.Mock).mockResolvedValue(
        mockMunicipality,
      );
      (tfdRepository.count as jest.Mock)
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(5);

      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
      };
      (tfdRepository.createQueryBuilder as jest.Mock)
        .mockReturnValueOnce(queryBuilder)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
        });

      const result = await service.getStats('org-1');

      expect(result.averagePerPatient).toBe(0);
    });

    it('should handle null spending result', async () => {
      (organizationService.findMunicipalityByOrganizationId as jest.Mock).mockResolvedValue(
        mockMunicipality,
      );
      (tfdRepository.count as jest.Mock)
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(5);

      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(15),
      };
      (tfdRepository.createQueryBuilder as jest.Mock)
        .mockReturnValueOnce(queryBuilder)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getRawOne: jest.fn().mockResolvedValue(null),
        });

      const result = await service.getStats('org-1');

      expect(result.monthlySpending).toBe(0);
      expect(result.averagePerPatient).toBe(0);
    });
  });
});
