'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Clock,
  CheckCircle,
  CalendarDays,
  Plus,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { TfdStatus } from '@govmunicipio/shared';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DashboardStats {
  total: number;
  pending: number;
  approved: number;
  thisMonth: number;
}

interface TfdRequestListItem {
  id: string;
  protocolNumber: string;
  statusId: string;
  requestDate: string;
  createdAt: string;
  patient?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  requestingDoctor?: {
    id: string;
    name: string;
  };
  destinationHospital?: {
    id: string;
    name: string;
  };
}

// ---------------------------------------------------------------------------
// Helpers
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

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

// ---------------------------------------------------------------------------
// Stats Card Sub-Component
// ---------------------------------------------------------------------------

function StatsCard({
  icon: Icon,
  label,
  value,
  colorClass,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  colorClass: string;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <Icon className={`h-5 w-5 ${colorClass}`} />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-8 w-20 animate-pulse rounded bg-muted" />
        ) : (
          <p className="text-3xl font-bold">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard Component
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    pending: 0,
    approved: 0,
    thisMonth: 0,
  });
  const [requests, setRequests] = useState<TfdRequestListItem[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient<DashboardStats>('/tfd/requests/stats')
      .then(setStats)
      .catch(() => {
        setError('Nao foi possivel carregar os dados do dashboard.');
      })
      .finally(() => setLoadingStats(false));

    apiClient<TfdRequestListItem[]>('/tfd/requests')
      .then((data) => setRequests(data.slice(0, 10)))
      .catch(() => {
        // Error already handled by stats — we just show empty table
      })
      .finally(() => setLoadingRequests(false));
  }, []);

  return (
    <div className="space-y-8">
      {/* Page header + Quick action */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Bem-vindo ao GovMunicipio
          </p>
        </div>
        <Button asChild>
          <Link href="/tfd/requests/new">
            <Plus />
            Nova Solicitacao TFD
          </Link>
        </Button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          icon={FileText}
          label="Total de Solicitacoes"
          value={stats.total}
          colorClass="text-blue-600"
          loading={loadingStats}
        />
        <StatsCard
          icon={Clock}
          label="Pendentes"
          value={stats.pending}
          colorClass="text-yellow-600"
          loading={loadingStats}
        />
        <StatsCard
          icon={CheckCircle}
          label="Aprovadas"
          value={stats.approved}
          colorClass="text-green-600"
          loading={loadingStats}
        />
        <StatsCard
          icon={CalendarDays}
          label="Este Mes"
          value={stats.thisMonth}
          colorClass="text-purple-600"
          loading={loadingStats}
        />
      </div>

      {/* Recent requests */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Solicitacoes Recentes</h2>
          <Button variant="link" asChild>
            <Link href="/tfd/requests">Ver todas</Link>
          </Button>
        </div>

        {loadingRequests ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Carregando...</span>
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-md border py-12">
            <p className="text-muted-foreground">
              Nenhuma solicitacao encontrada.
            </p>
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Protocolo</TableHead>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow
                      key={request.id}
                      className="cursor-pointer"
                      onClick={() =>
                        router.push(`/tfd/requests/${request.id}`)
                      }
                    >
                      <TableCell className="font-medium">
                        {request.protocolNumber}
                      </TableCell>
                      <TableCell>
                        {request.patient
                          ? `${request.patient.firstName} ${request.patient.lastName}`
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(request.statusId)}>
                          {STATUS_LABELS[request.statusId] ??
                            request.statusId}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {formatDate(request.requestDate)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
