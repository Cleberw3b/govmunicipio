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
  TrendingUp,
  Users,
} from 'lucide-react';
import { TfdStatus } from '@govmunicipio/shared';
import { apiClient } from '@/lib/api';
import { isAdminMunicipality } from '@/lib/admin-auth';
import { Button } from '@/components/ui/button';
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
  inTransit: number;
  thisMonth: number;
  monthlySpending: number;
  averagePerPatient: number;
}

interface TfdRequestListItem {
  id: string;
  protocolNumber: string;
  requestDate: string | null;
  createdAt: string;
  status: { id: string; code: string; name: string };
  patientPerson?: { firstName: string; lastName: string } | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<string, string> = {
  [TfdStatus.DRAFT]: 'Rascunho',
  [TfdStatus.PENDING]: 'Pendente',
  [TfdStatus.IN_TRANSIT]: 'Em Trânsito',
  [TfdStatus.FINALIZED]: 'Finalizado',
  [TfdStatus.CANCELLED]: 'Cancelado',
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

// ---------------------------------------------------------------------------
// Stats Card Sub-Component
// ---------------------------------------------------------------------------

function StatsCard({
  icon: Icon,
  label,
  value,
  colorClass,
  loading,
  currency = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  colorClass: string;
  loading: boolean;
  currency?: boolean;
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
        ) : currency ? (
          <p className="text-2xl font-bold">
            R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
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
    inTransit: 0,
    thisMonth: 0,
    monthlySpending: 0,
    averagePerPatient: 0,
  });
  const showFinance = isAdminMunicipality();
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

    apiClient<{ data: TfdRequestListItem[]; meta: unknown }>('/tfd/requests?limit=10')
      .then((res) => setRequests(Array.isArray(res?.data) ? res.data : []))
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
          label="Em Trânsito"
          value={stats.inTransit}
          colorClass="text-blue-600"
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

      {/* Finance cards — visible only to admin_municipality */}
      {showFinance && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatsCard
            icon={TrendingUp}
            label="Gasto no Mês Atual"
            value={stats.monthlySpending}
            colorClass="text-rose-600"
            loading={loadingStats}
            currency
          />
          <StatsCard
            icon={Users}
            label="Média por Paciente (Mês)"
            value={stats.averagePerPatient}
            colorClass="text-orange-600"
            loading={loadingStats}
            currency
          />
        </div>
      )}

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
                        {request.patientPerson
                          ? `${request.patientPerson.firstName} ${request.patientPerson.lastName}`
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getStatusClass(request.status.code)}`}>
                          {STATUS_LABELS[request.status.code] ?? request.status.name}
                        </span>
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
