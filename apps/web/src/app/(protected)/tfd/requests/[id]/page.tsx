'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
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
// Types
// ---------------------------------------------------------------------------

interface TfdRequestDetail {
  id: string;
  protocolNumber: string;
  statusId: string;
  diagnosisCid: string;
  procedureDescription: string;
  justification: string;
  requestDate: string;
  travelDate?: string | null;
  returnDate?: string | null;
  transportType: TransportType;
  estimatedCost?: number | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  patient?: {
    id: string;
    firstName: string;
    lastName: string;
    identification?: {
      cpf: string;
      susCardNumber?: string | null;
      dateOfBirth: string;
    };
  };
  companion?: {
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
    name: string;
    crm: string;
    specialties?: { id: string; name: string }[];
  };
  destinationHospital?: {
    id: string;
    name: string;
    cnes: string;
    city?: string;
  };
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
  statusId: string,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (statusId) {
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
  return new Date(dateStr).toLocaleDateString('pt-BR');
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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => router.push('/tfd/requests')}>
          <ArrowLeft />
          Voltar
        </Button>
        <h1 className="text-2xl font-bold">Solicitação TFD</h1>
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
            <Badge variant={getStatusVariant(request.statusId)}>
              {STATUS_LABELS[request.statusId] ?? request.statusId}
            </Badge>
          </div>
          <p>
            <strong>Data de Criação:</strong>{' '}
            {formatDate(request.createdAt)}
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
          {request.patient ? (
            <>
              <p>
                <strong>Nome:</strong> {request.patient.firstName}{' '}
                {request.patient.lastName}
              </p>
              {request.patient.identification?.cpf && (
                <p>
                  <strong>CPF:</strong> {request.patient.identification.cpf}
                </p>
              )}
              {request.patient.identification?.susCardNumber && (
                <p>
                  <strong>Cartão SUS:</strong>{' '}
                  {request.patient.identification.susCardNumber}
                </p>
              )}
              {request.patient.identification?.dateOfBirth && (
                <p>
                  <strong>Data de Nascimento:</strong>{' '}
                  {formatDate(request.patient.identification.dateOfBirth)}
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
          {request.companion ? (
            <>
              <p>
                <strong>Nome:</strong> {request.companion.firstName}{' '}
                {request.companion.lastName}
              </p>
              {request.companion.identification?.cpf && (
                <p>
                  <strong>CPF:</strong>{' '}
                  {request.companion.identification.cpf}
                </p>
              )}
              {request.companion.identification?.susCardNumber && (
                <p>
                  <strong>Cartão SUS:</strong>{' '}
                  {request.companion.identification.susCardNumber}
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
              <p>
                <strong>Nome:</strong> {request.requestingDoctor.name}
              </p>
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
              Informações do médico não disponíveis
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
              <p>
                <strong>Nome:</strong> {request.destinationHospital.name}
              </p>
              <p>
                <strong>CNES:</strong> {request.destinationHospital.cnes}
              </p>
              {request.destinationHospital.city && (
                <p>
                  <strong>Cidade:</strong> {request.destinationHospital.city}
                </p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">
              Informações do hospital não disponíveis
            </p>
          )}
        </CardContent>
      </Card>

      {/* Clinical data */}
      <Card>
        <CardHeader>
          <CardTitle>Dados Clínicos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <strong>CID-10:</strong> {request.diagnosisCid}
          </p>
          <Separator />
          <p>
            <strong>Descrição do Procedimento:</strong>
          </p>
          <p className="text-muted-foreground">
            {request.procedureDescription}
          </p>
          <Separator />
          <p>
            <strong>Justificativa:</strong>
          </p>
          <p className="text-muted-foreground">{request.justification}</p>
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
          <Separator />
          <p>
            <strong>Tipo de Transporte:</strong>{' '}
            {TRANSPORT_LABELS[request.transportType] ?? request.transportType}
          </p>
          {request.estimatedCost != null && (
            <p>
              <strong>Custo Estimado:</strong> R${' '}
              {Number(request.estimatedCost).toFixed(2)}
            </p>
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
