'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, PencilLine } from 'lucide-react';
import { TfdStatus, TransportType } from '@govmunicipio/shared';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

// ---------------------------------------------------------------------------
// Types — match actual API entity shape
// ---------------------------------------------------------------------------

interface TfdRequestDetail {
  id: string;
  protocolNumber: string;
  diagnosisCid: string | null;
  procedureDescription: string | null;
  justification: string | null;
  requestDate: string | null;
  travelDate?: string | null;
  returnDate?: string | null;
  transportType: TransportType | null;
  estimatedCost?: number | null;
  transportationCost?: number | null;
  foodCost?: number | null;
  hotelCost?: number | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  status: { id: string; code: string; name: string };
  patientPerson?: {
    id: string;
    firstName: string;
    lastName: string;
    identification?: {
      cpf: string;
      susCardNumber?: string | null;
      dateOfBirth: string;
    };
  };
  companionPerson?: {
    id: string;
    firstName: string;
    lastName: string;
    identification?: {
      cpf: string;
      susCardNumber?: string | null;
      dateOfBirth: string;
    };
  } | null;
  requestingDoctor?: {
    id: string;
    crm: string;
    person?: { firstName: string; lastName: string };
    specialties?: { id: string; name: string }[];
  } | null;
  destinationHospital?: {
    id: string;
    cnesCode: string;
    organization?: { name: string; address?: { city?: string } };
  } | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<string, string> = {
  [TfdStatus.DRAFT]: 'Rascunho',
  [TfdStatus.PENDING]: 'Pendente',
  [TfdStatus.APPROVED]: 'Aprovado',
  [TfdStatus.REJECTED]: 'Rejeitado',
  [TfdStatus.SCHEDULED]: 'Agendado',
  [TfdStatus.COMPLETED]: 'Concluído',
  [TfdStatus.CANCELLED]: 'Cancelado',
};

const TRANSPORT_LABELS: Record<TransportType, string> = {
  [TransportType.BUS]: 'Ônibus',
  [TransportType.VAN]: 'Van',
  [TransportType.AMBULANCE]: 'Ambulância',
  [TransportType.AIR]: 'Aéreo',
  [TransportType.OWN_VEHICLE]: 'Veículo Próprio',
  [TransportType.OTHER]: 'Outro',
};

function getStatusVariant(
  code: string,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (code) {
    case TfdStatus.APPROVED:
    case TfdStatus.COMPLETED:
      return 'default';
    case TfdStatus.PENDING:
    case TfdStatus.SCHEDULED:
      return 'secondary';
    case TfdStatus.REJECTED:
    case TfdStatus.CANCELLED:
      return 'destructive';
    default:
      return 'outline';
  }
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TfdRequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [request, setRequest] = useState<TfdRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const id = params.id as string;
    if (!id) return;

    apiClient<TfdRequestDetail>(`/tfd/requests/${id}`)
      .then(setRequest)
      .catch((err) =>
        setError(
          err instanceof Error ? err.message : 'Erro ao carregar solicitação.',
        ),
      )
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Carregando...</span>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => router.push('/tfd/requests')}>
          <ArrowLeft />
          Voltar
        </Button>
        <div className="flex flex-col items-center justify-center rounded-md border py-12">
          <p className="text-muted-foreground">
            {error || 'Solicitação não encontrada.'}
          </p>
        </div>
      </div>
    );
  }

  const doctorName = request.requestingDoctor?.person
    ? `${request.requestingDoctor.person.firstName} ${request.requestingDoctor.person.lastName}`
    : request.requestingDoctor?.crm ?? null;

  const hospitalName =
    request.destinationHospital?.organization?.name ??
    request.destinationHospital?.cnesCode ??
    null;

  const hospitalCity =
    request.destinationHospital?.organization?.address?.city ?? null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => router.push('/tfd/requests')}>
            <ArrowLeft />
            Voltar
          </Button>
          <h1 className="text-2xl font-bold">Solicitação TFD</h1>
        </div>
        {request.status.code === TfdStatus.DRAFT && (
          <Button
            onClick={() => {
              localStorage.setItem('tfd_draft_id', request.id);
              router.push('/tfd/requests/new');
            }}
          >
            <PencilLine />
            Continuar Solicitação
          </Button>
        )}
      </div>

      {/* Protocol info */}
      <Card>
        <CardHeader>
          <CardTitle>Informações do Protocolo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-4">
            <p>
              <strong>Protocolo:</strong> {request.protocolNumber}
            </p>
            <Badge variant={getStatusVariant(request.status.code)}>
              {STATUS_LABELS[request.status.code] ?? request.status.name}
            </Badge>
          </div>
          <p>
            <strong>Data de Criação:</strong> {formatDate(request.createdAt)}
          </p>
          <p>
            <strong>Última Atualização:</strong>{' '}
            {formatDate(request.updatedAt)}
          </p>
        </CardContent>
      </Card>

      {/* Patient */}
      <Card>
        <CardHeader>
          <CardTitle>Paciente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {request.patientPerson ? (
            <>
              <p>
                <strong>Nome:</strong> {request.patientPerson.firstName}{' '}
                {request.patientPerson.lastName}
              </p>
              {request.patientPerson.identification?.cpf && (
                <p>
                  <strong>CPF:</strong>{' '}
                  {request.patientPerson.identification.cpf}
                </p>
              )}
              {request.patientPerson.identification?.susCardNumber && (
                <p>
                  <strong>Cartão SUS:</strong>{' '}
                  {request.patientPerson.identification.susCardNumber}
                </p>
              )}
              {request.patientPerson.identification?.dateOfBirth && (
                <p>
                  <strong>Data de Nascimento:</strong>{' '}
                  {formatDate(
                    request.patientPerson.identification.dateOfBirth,
                  )}
                </p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">
              Informações do paciente não disponíveis
            </p>
          )}
        </CardContent>
      </Card>

      {/* Companion */}
      <Card>
        <CardHeader>
          <CardTitle>Acompanhante</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {request.companionPerson ? (
            <>
              <p>
                <strong>Nome:</strong> {request.companionPerson.firstName}{' '}
                {request.companionPerson.lastName}
              </p>
              {request.companionPerson.identification?.cpf && (
                <p>
                  <strong>CPF:</strong>{' '}
                  {request.companionPerson.identification.cpf}
                </p>
              )}
              {request.companionPerson.identification?.susCardNumber && (
                <p>
                  <strong>Cartão SUS:</strong>{' '}
                  {request.companionPerson.identification.susCardNumber}
                </p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">Sem acompanhante</p>
          )}
        </CardContent>
      </Card>

      {/* Doctor */}
      <Card>
        <CardHeader>
          <CardTitle>Médico Solicitante</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {request.requestingDoctor ? (
            <>
              {doctorName && (
                <p>
                  <strong>Nome:</strong> {doctorName}
                </p>
              )}
              <p>
                <strong>CRM:</strong> {request.requestingDoctor.crm}
              </p>
              {request.requestingDoctor.specialties &&
                request.requestingDoctor.specialties.length > 0 && (
                  <p>
                    <strong>Especialidades:</strong>{' '}
                    {request.requestingDoctor.specialties
                      .map((s) => s.name)
                      .join(', ')}
                  </p>
                )}
            </>
          ) : (
            <p className="text-muted-foreground">
              Médico não informado
            </p>
          )}
        </CardContent>
      </Card>

      {/* Hospital */}
      <Card>
        <CardHeader>
          <CardTitle>Hospital Destino</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {request.destinationHospital ? (
            <>
              {hospitalName && (
                <p>
                  <strong>Nome:</strong> {hospitalName}
                </p>
              )}
              <p>
                <strong>CNES:</strong> {request.destinationHospital.cnesCode}
              </p>
              {hospitalCity && (
                <p>
                  <strong>Cidade:</strong> {hospitalCity}
                </p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">Hospital não informado</p>
          )}
        </CardContent>
      </Card>

      {/* Clinical data */}
      <Card>
        <CardHeader>
          <CardTitle>Dados Clínicos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {request.diagnosisCid ? (
            <p>
              <strong>CID-10:</strong> {request.diagnosisCid}
            </p>
          ) : (
            <p className="text-muted-foreground">CID não informado</p>
          )}
          {request.procedureDescription && (
            <>
              <Separator />
              <p>
                <strong>Descrição do Procedimento:</strong>
              </p>
              <p className="text-muted-foreground">
                {request.procedureDescription}
              </p>
            </>
          )}
          {request.justification && (
            <>
              <Separator />
              <p>
                <strong>Justificativa:</strong>
              </p>
              <p className="text-muted-foreground">{request.justification}</p>
            </>
          )}
          <Separator />
          <div className="grid gap-2 sm:grid-cols-2">
            <p>
              <strong>Data da Solicitação:</strong>{' '}
              {formatDate(request.requestDate)}
            </p>
            {request.travelDate && (
              <p>
                <strong>Data da Viagem:</strong>{' '}
                {formatDate(request.travelDate)}
              </p>
            )}
            {request.returnDate && (
              <p>
                <strong>Data de Retorno:</strong>{' '}
                {formatDate(request.returnDate)}
              </p>
            )}
          </div>
          {request.transportType && (
            <>
              <Separator />
              <p>
                <strong>Tipo de Transporte:</strong>{' '}
                {TRANSPORT_LABELS[request.transportType] ??
                  request.transportType}
              </p>
            </>
          )}
          {request.estimatedCost != null && (
            <p>
              <strong>Custo Estimado:</strong> R${' '}
              {Number(request.estimatedCost).toFixed(2)}
            </p>
          )}
          {(request.transportationCost != null ||
            request.foodCost != null ||
            request.hotelCost != null) && (
            <>
              <Separator />
              <p>
                <strong>Custos Reais:</strong>
              </p>
              <div className="ml-2 space-y-1">
                {request.transportationCost != null && (
                  <p>
                    Transporte: R${' '}
                    {Number(request.transportationCost).toLocaleString(
                      'pt-BR',
                      { minimumFractionDigits: 2 },
                    )}
                  </p>
                )}
                {request.foodCost != null && (
                  <p>
                    Alimentação: R${' '}
                    {Number(request.foodCost).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                )}
                {request.hotelCost != null && (
                  <p>
                    Hospedagem: R${' '}
                    {Number(request.hotelCost).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                )}
                <p className="font-medium">
                  Total: R${' '}
                  {(
                    (Number(request.transportationCost) || 0) +
                    (Number(request.foodCost) || 0) +
                    (Number(request.hotelCost) || 0)
                  ).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </>
          )}
          {request.notes && (
            <>
              <Separator />
              <p>
                <strong>Observações:</strong>
              </p>
              <p className="text-muted-foreground">{request.notes}</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
