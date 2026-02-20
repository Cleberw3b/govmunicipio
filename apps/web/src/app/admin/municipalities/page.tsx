'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';

interface Municipality {
  id: string;
  ibgeCode: string;
  state: string;
  organization: {
    name: string;
    cnpj: string;
    isActive: boolean;
    address: { city: string } | null;
  };
}

export default function MunicipalitiesPage() {
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient<Municipality[]>('/admin/municipalities')
      .then(setMunicipalities)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Municípios</h1>
          <p className="text-muted-foreground">
            {municipalities.length} município(s) cadastrado(s)
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/municipalities/new">
            <Plus className="mr-2 h-4 w-4" />
            Novo Município
          </Link>
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Cidade/UF</TableHead>
                <TableHead>Cód. IBGE</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {municipalities.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground"
                  >
                    Nenhum município cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                municipalities.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">
                      {m.organization.name}
                    </TableCell>
                    <TableCell>{m.organization.cnpj}</TableCell>
                    <TableCell>
                      {m.organization.address?.city ?? '—'}/{m.state}
                    </TableCell>
                    <TableCell>{m.ibgeCode}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          m.organization.isActive ? 'default' : 'secondary'
                        }
                      >
                        {m.organization.isActive ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
