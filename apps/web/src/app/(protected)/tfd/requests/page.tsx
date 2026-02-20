'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Loader2 } from 'lucide-react';
import { TfdStatus } from '@govmunicipio/shared';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

function getStatusLabel(statusId: string): string {
  const option = STATUS_OPTIONS.find((o) => o.value === statusId);
  return option?.label ?? statusId;
}

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
                  {request.patient
                    ? `${request.patient.firstName} ${request.patient.lastName}`
                    : '-'}
                </TableCell>
                <TableCell>
                  {request.requestingDoctor?.name ?? '-'}
                </TableCell>
                <TableCell>
                  {request.destinationHospital?.name ?? '-'}
                </TableCell>
                <TableCell>
                  <Badge variant={getStatusVariant(request.statusId)}>
                    {getStatusLabel(request.statusId)}
                  </Badge>
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
