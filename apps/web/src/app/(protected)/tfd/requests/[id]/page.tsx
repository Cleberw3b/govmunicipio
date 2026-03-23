'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, PencilLine, Truck, CheckCircle2, XCircle } from 'lucide-react';
import { TfdStatus, TransportType } from '@govmunicipio/shared';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';

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
  departureCustomAddress?: string | null;
  pickupAddress?: {
    id: string;
    name: string;
    street: string;
    number: string;
    complement?: string | null;
    neighborhood: string;
    city: string;
    state: string;
  } | null;
  returnPickupAddress?: {
    id: string;
    name: string;
    street: string;
    number: string;
    complement?: string | null;
    neighborhood: string;
    city: string;
    state: string;
  } | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<string, string> = {
  [TfdStatus.DRAFT]: 'Rascunho',
  [TfdStatus.PENDING]: 'Pendente',
  [TfdStatus.IN_TRANSIT]: 'Em Trânsito',
  [TfdStatus.FINALIZED]: 'Finalizado',
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

function getStatusClass(code: string): string {
  switch (code) {
    case TfdStatus.PENDING:
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case TfdStatus.IN_TRANSIT:
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case TfdStatus.FINALIZED:
      return 'bg-green-100 text-green-800 border-green-200';
    case TfdStatus.CANCELLED:
      return 'bg-gray-100 text-gray-600 border-gray-200';
    default:
      return 'bg-gray-100 text-gray-600 border-gray-200';
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
  const [actionLoading, setActionLoading] = useState(false);

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    variant: 'default' | 'destructive';
    onConfirm: () => Promise<void>;
  }>({
    open: false,
    title: '',
    description: '',
    confirmLabel: '',
    variant: 'default',
    onConfirm: async () => {},
  });

  const fetchRequest = useCallback(async () => {
    const id = params.id as string;
    if (!id) return;
    try {
      const data = await apiClient<TfdRequestDetail>(`/tfd/requests/${id}`);
      setRequest(data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar solicitação.');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchRequest();
  }, [fetchRequest]);

  const handleStatusChange = async (statusCode: string) => {
    if (!request) return;
    setActionLoading(true);
    try {
      await apiClient(`/tfd/requests/${request.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ statusCode }),
      });
      await fetchRequest();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao alterar status.');
    } finally {
      setActionLoading(false);
      setConfirmDialog((prev) => ({ ...prev, open: false }));
    }
  };

  const openConfirmDialog = (
    title: string,
    description: string,
    confirmLabel: string,
    variant: 'default' | 'destructive',
    statusCode: string,
  ) => {
    setConfirmDialog({
      open: true,
      title,
      description,
      confirmLabel,
      variant,
      onConfirm: () => handleStatusChange(statusCode),
    });
  };

  const handleEdit = () => {
    if (!request) return;
    localStorage.setItem('tfd_draft_id', request.id);
    router.push('/tfd/requests/new');
  };

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

  const statusCode = request.status.code;
  const canEdit = statusCode === TfdStatus.DRAFT || statusCode === TfdStatus.PENDING;
  const isTerminal = statusCode === TfdStatus.FINALIZED || statusCode === TfdStatus.CANCELLED;

  return (
    <div className="mx-auto max-w-3xl space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" className="-ml-2" onClick={() => router.push('/tfd/requests')}>
          <ArrowLeft />
          Voltar
        </Button>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-xl font-bold">Solicitação TFD</h1>
          <p className="text-sm text-muted-foreground">{request.protocolNumber}</p>
        </div>
        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${getStatusClass(statusCode)}`}>
          {STATUS_LABELS[statusCode] ?? request.status.name}
        </span>
      </div>

      {/* Action Bar */}
      {!isTerminal && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3">
          {/* Forward action buttons */}
          {statusCode === TfdStatus.DRAFT && (
            <Button
              variant="outline"
              onClick={handleEdit}
              disabled={actionLoading}
            >
              <PencilLine className="h-4 w-4" />
              Editar
            </Button>
          )}

          {statusCode === TfdStatus.PENDING && (
            <>
              <Button
                onClick={() =>
                  openConfirmDialog(
                    'Iniciar Transporte',
                    'Confirma que o transporte do paciente foi iniciado?',
                    'Iniciar Transporte',
                    'default',
                    'in_transit',
                  )
                }
                disabled={actionLoading}
              >
                <Truck className="h-4 w-4" />
                Iniciar Transporte
              </Button>
              <Button
                variant="outline"
                onClick={handleEdit}
                disabled={actionLoading}
              >
                <PencilLine className="h-4 w-4" />
                Editar
              </Button>
            </>
          )}

          {statusCode === TfdStatus.IN_TRANSIT && (
            <Button
              onClick={() =>
                openConfirmDialog(
                  'Finalizar Atendimento',
                  'Confirma que o atendimento foi concluído?',
                  'Finalizar',
                  'default',
                  'finalized',
                )
              }
              disabled={actionLoading}
            >
              <CheckCircle2 className="h-4 w-4" />
              Finalizar
            </Button>
          )}

          {/* Cancel button (available for draft, pending, in_transit) */}
          <Button
            variant="outline"
            className="border-destructive/40 text-destructive hover:bg-destructive hover:text-white"
            onClick={() =>
              openConfirmDialog(
                'Cancelar Solicitação',
                'Tem certeza que deseja cancelar esta solicitação? Esta ação não pode ser desfeita.',
                'Cancelar Solicitação',
                'destructive',
                'cancelled',
              )
            }
            disabled={actionLoading}
          >
            <XCircle className="h-4 w-4" />
            Cancelar
          </Button>
        </div>
      )}

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
      <Section title="Dados Clínicos">
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
      <Section title="Viagem">
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
          {request.departureCustomAddress && (
            <Field label="Embarque (Ida)" value={request.departureCustomAddress} />
          )}
          {request.pickupAddress && !request.departureCustomAddress && (
            <Field
              label="Embarque (Ida)"
              value={`${request.pickupAddress.name} — ${request.pickupAddress.street}, ${request.pickupAddress.number}, ${request.pickupAddress.city}/${request.pickupAddress.state}`}
            />
          )}
          {request.returnPickupAddress && (
            <Field
              label="Embarque (Retorno)"
              value={`${request.returnPickupAddress.name} — ${request.returnPickupAddress.street}, ${request.returnPickupAddress.number}, ${request.returnPickupAddress.city}/${request.returnPickupAddress.state}`}
            />
          )}
        </div>
      </Section>

      {/* Custos */}
      {(hasCosts || request.notes) && (
        <Section title="Custos">
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

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel={confirmDialog.confirmLabel}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
        loading={actionLoading}
      />

    </div>
  );
}
