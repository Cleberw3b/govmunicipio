'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Loader2 } from 'lucide-react';
import { TfdStatus } from '@govmunicipio/shared';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface TfdRequestListItem {
  id: string;
  protocolNumber: string;
  requestDate: string | null;
  createdAt: string;
  status: { id: string; code: string; name: string };
  patientPerson?: { id: string; firstName: string; lastName: string };
  requestingDoctor?: {
    id: string;
    crm: string;
    person?: { firstName: string; lastName: string };
  };
  destinationHospital?: {
    id: string;
    cnesCode: string;
    organization?: { name: string };
  };
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: TfdStatus.DRAFT, label: 'Rascunho' },
  { value: TfdStatus.PENDING, label: 'Pendente' },
  { value: TfdStatus.APPROVED, label: 'Aprovado' },
  { value: TfdStatus.REJECTED, label: 'Rejeitado' },
  { value: TfdStatus.SCHEDULED, label: 'Agendado' },
  { value: TfdStatus.COMPLETED, label: 'Concluído' },
  { value: TfdStatus.CANCELLED, label: 'Cancelado' },
];

const STATUS_LABELS: Record<string, string> = {
  [TfdStatus.DRAFT]: 'Rascunho',
  [TfdStatus.PENDING]: 'Pendente',
  [TfdStatus.APPROVED]: 'Aprovado',
  [TfdStatus.REJECTED]: 'Rejeitado',
  [TfdStatus.SCHEDULED]: 'Agendado',
  [TfdStatus.COMPLETED]: 'Concluído',
  [TfdStatus.CANCELLED]: 'Cancelado',
};

function getStatusClass(code: string): string {
  switch (code) {
    case TfdStatus.APPROVED:
      return 'bg-green-100 text-green-800 border-green-200';
    case TfdStatus.COMPLETED:
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case TfdStatus.PENDING:
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case TfdStatus.SCHEDULED:
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case TfdStatus.REJECTED:
      return 'bg-red-100 text-red-800 border-red-200';
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

function doctorName(
  d: TfdRequestListItem['requestingDoctor'],
): string {
  if (!d) return '-';
  if (d.person) return `${d.person.firstName} ${d.person.lastName}`;
  return d.crm;
}

export default function TfdRequestListPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<TfdRequestListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const query = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const data = await apiClient<TfdRequestListItem[]>(
        `/tfd/requests${query}`,
      );
      setRequests(data);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Solicitações TFD</h1>
        <Button asChild>
          <Link href="/tfd/requests/new">
            <Plus />
            Nova Solicitação
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Carregando...</span>
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border py-12">
          <p className="text-muted-foreground">
            Nenhuma solicitação encontrada.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Protocolo</TableHead>
              <TableHead>Paciente</TableHead>
              <TableHead>Médico</TableHead>
              <TableHead>Hospital</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((request) => (
              <TableRow
                key={request.id}
                className="cursor-pointer"
                onClick={() => router.push(`/tfd/requests/${request.id}`)}
              >
                <TableCell className="font-medium">
                  {request.protocolNumber}
                </TableCell>
                <TableCell>
                  {request.patientPerson
                    ? `${request.patientPerson.firstName} ${request.patientPerson.lastName}`
                    : '-'}
                </TableCell>
                <TableCell>{doctorName(request.requestingDoctor)}</TableCell>
                <TableCell>
                  {request.destinationHospital?.organization?.name ??
                    request.destinationHospital?.cnesCode ??
                    '-'}
                </TableCell>
                <TableCell>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getStatusClass(request.status.code)}`}>
                    {STATUS_LABELS[request.status.code] ?? request.status.name}
                  </span>
                </TableCell>
                <TableCell>{formatDate(request.requestDate)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
