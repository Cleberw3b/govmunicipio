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
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

// ---------------------------------------------------------------------------
// Types
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
  transportationCost?: number | null;
  foodCost?: number | null;
  hotelCost?: number | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  status: { id: string; code: string; name: string };
  specialty?: { id: string; name: string } | null;
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
    specialties?: { id: string; name: string }[];
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

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '-';
  return Number(value).toLocaleString(undefined, {
    style: 'currency',
    currency: 'BRL',
  });
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm">{value || '-'}</p>
    </div>
  );
}

function Section({
  title,
  description,
  children,
  aside,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {aside}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
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
        <Button variant="ghost" size="sm" className="-ml-2" onClick={() => router.push('/tfd/requests')}>
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
    : request.requestingDoctor?.crm ?? '-';

  const hospitalName =
    request.destinationHospital?.organization?.name ??
    request.destinationHospital?.cnesCode ??
    '-';

  const hospitalCity =
    request.destinationHospital?.organization?.address?.city ?? null;

  const hasCosts =
    request.transportationCost != null ||
    request.foodCost != null ||
    request.hotelCost != null;

  const totalCost =
    (Number(request.transportationCost) || 0) +
    (Number(request.foodCost) || 0) +
    (Number(request.hotelCost) || 0);

  return (
    <div className="mx-auto max-w-3xl space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="-ml-2" onClick={() => router.push('/tfd/requests')}>
            <ArrowLeft />
            Voltar
          </Button>
          <div>
            <h1 className="text-xl font-bold">Solicitação TFD</h1>
            <p className="text-sm text-muted-foreground">{request.protocolNumber}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={getStatusVariant(request.status.code)}>
            {STATUS_LABELS[request.status.code] ?? request.status.name}
          </Badge>
          {request.status.code === TfdStatus.DRAFT && (
            <Button
              size="sm"
              onClick={() => {
                localStorage.setItem('tfd_draft_id', request.id);
                router.push('/tfd/requests/new');
              }}
            >
              <PencilLine />
              Continuar
            </Button>
          )}
        </div>
      </div>

      {/* Protocol */}
      <Section
        title="Protocolo"
        aside={
          <p className="text-xs text-muted-foreground">
            Atualizado em {formatDate(request.updatedAt)}
          </p>
        }
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 text-sm">
          <Field label="Número" value={request.protocolNumber} />
          <Field label="Criado em" value={formatDate(request.createdAt)} />
          <Field label="Atualizado em" value={formatDate(request.updatedAt)} />
        </div>
      </Section>

      {/* Patient */}
      <Section title="Paciente">
        {request.patientPerson ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field
              label="Nome"
              value={`${request.patientPerson.firstName} ${request.patientPerson.lastName}`}
            />
            {request.patientPerson.identification?.cpf && (
              <Field label="CPF" value={request.patientPerson.identification.cpf} />
            )}
            {request.patientPerson.identification?.susCardNumber && (
              <Field label="Cartão SUS" value={request.patientPerson.identification.susCardNumber} />
            )}
            {request.patientPerson.identification?.dateOfBirth && (
              <Field
                label="Data de Nascimento"
                value={formatDate(request.patientPerson.identification.dateOfBirth)}
              />
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Informações do paciente não disponíveis</p>
        )}
      </Section>

      {/* Companion */}
      {request.companionPerson ? (
        <Section title="Acompanhante">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field
              label="Nome"
              value={`${request.companionPerson.firstName} ${request.companionPerson.lastName}`}
            />
            {request.companionPerson.identification?.cpf && (
              <Field label="CPF" value={request.companionPerson.identification.cpf} />
            )}
            {request.companionPerson.identification?.susCardNumber && (
              <Field label="Cartão SUS" value={request.companionPerson.identification.susCardNumber} />
            )}
          </div>
        </Section>
      ) : null}

      {/* Doctor */}
      <Section title="Médico Solicitante">
        {request.requestingDoctor ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="Nome" value={doctorName} />
            <Field label="CRM" value={request.requestingDoctor.crm} />
            {request.requestingDoctor.specialties && request.requestingDoctor.specialties.length > 0 && (
              <Field
                label="Especialidades"
                value={request.requestingDoctor.specialties.map((s) => s.name).join(', ')}
              />
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Médico não informado</p>
        )}
      </Section>

      {/* Hospital */}
      <Section title="Hospital Destino">
        {request.destinationHospital ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="Nome" value={hospitalName} />
            <Field label="CNES" value={request.destinationHospital.cnesCode} />
            {hospitalCity && <Field label="Cidade" value={hospitalCity} />}
            {request.destinationHospital.specialties && request.destinationHospital.specialties.length > 0 && (
              <Field
                label="Especialidades"
                value={request.destinationHospital.specialties.map((s) => s.name).join(', ')}
              />
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Hospital não informado</p>
        )}
      </Section>

      {/* Dados Clínicos */}
      <Section title="Dados Clínicos" description="Diagnóstico, procedimento e justificativa">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="CID-10" value={request.diagnosisCid} />
            {request.specialty && (
              <Field label="Especialidade" value={request.specialty.name} />
            )}
          </div>
          {request.procedureDescription && (
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Descrição do Procedimento</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{request.procedureDescription}</p>
            </div>
          )}
          {request.justification && (
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Justificativa</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{request.justification}</p>
            </div>
          )}
        </div>
      </Section>

      {/* Viagem */}
      <Section
        title="Viagem"
        description="Datas e transporte"
        aside={
          <div className="text-right">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Data da Solicitação</p>
            <p className="text-sm">{formatDate(request.requestDate)}</p>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {request.travelDate && (
            <Field label="Data da Viagem" value={formatDate(request.travelDate)} />
          )}
          {request.returnDate && (
            <Field label="Data de Retorno" value={formatDate(request.returnDate)} />
          )}
          {request.transportType && (
            <Field
              label="Transporte"
              value={TRANSPORT_LABELS[request.transportType] ?? request.transportType}
            />
          )}
        </div>
      </Section>

      {/* Custos */}
      {(hasCosts || request.notes) && (
        <Section title="Custos" description="Transporte, alimentação e hospedagem">
          <div className="space-y-4">
            {hasCosts && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {request.transportationCost != null && (
                  <Field label="Transporte" value={formatCurrency(request.transportationCost)} />
                )}
                {request.foodCost != null && (
                  <Field label="Alimentação" value={formatCurrency(request.foodCost)} />
                )}
                {request.hotelCost != null && (
                  <Field label="Hospedagem" value={formatCurrency(request.hotelCost)} />
                )}
                <Field label="Total" value={formatCurrency(totalCost)} />
              </div>
            )}
            {request.notes && (
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Observações</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{request.notes}</p>
              </div>
            )}
          </div>
        </Section>
      )}

    </div>
  );
}
