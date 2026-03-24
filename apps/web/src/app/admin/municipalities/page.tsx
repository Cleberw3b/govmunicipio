'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { apiClient } from '@/lib/api';

interface Municipality {
  id: string;
  ibgeCode: string;
  state: string;
  organization: {
    name: string;
    cnpj: string;
    isActive: boolean;
    address: { city: string; street: string; number: string; neighborhood: string; zipCode: string; state: string } | null;
  };
}

interface EditForm {
  name: string;
  cnpj: string;
  ibgeCode: string;
  state: string;
  city: string;
  street: string;
  number: string;
  neighborhood: string;
  zipCode: string;
  isActive: boolean;
}

export default function MunicipalitiesPage() {
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Municipality | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    return apiClient<Municipality[]>('/admin/municipalities')
      .then((d) => setMunicipalities(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function openEdit(m: Municipality) {
    setEditing(m);
    setForm({
      name: m.organization.name,
      cnpj: m.organization.cnpj,
      ibgeCode: m.ibgeCode,
      state: m.state,
      city: m.organization.address?.city ?? '',
      street: m.organization.address?.street ?? '',
      number: m.organization.address?.number ?? '',
      neighborhood: m.organization.address?.neighborhood ?? '',
      zipCode: m.organization.address?.zipCode ?? '',
      isActive: m.organization.isActive,
    });
  }

  function updateField(field: keyof EditForm) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => prev ? { ...prev, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value } : prev);
  }

  async function handleSave() {
    if (!editing || !form) return;
    setSaving(true);
    try {
      await apiClient(`/admin/municipalities/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
      toast.success('Município atualizado!');
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar');
    } finally {
      setSaving(false);
    }
  }

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
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {municipalities.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Nenhum município cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                municipalities.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.organization.name}</TableCell>
                    <TableCell>{m.organization.cnpj}</TableCell>
                    <TableCell>{m.organization.address?.city ?? '—'}/{m.state}</TableCell>
                    <TableCell>{m.ibgeCode}</TableCell>
                    <TableCell>
                      <Badge variant={m.organization.isActive ? 'default' : 'secondary'}>
                        {m.organization.isActive ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" onClick={() => openEdit(m)}>
                        <Pencil className="h-4 w-4" />
                        Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Município</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome da Prefeitura</Label>
                <Input value={form.name} onChange={updateField('name')} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>CNPJ</Label>
                  <Input value={form.cnpj} onChange={updateField('cnpj')} placeholder="XX.XXX.XXX/XXXX-XX" />
                </div>
                <div className="space-y-2">
                  <Label>Código IBGE</Label>
                  <Input value={form.ibgeCode} onChange={updateField('ibgeCode')} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input value={form.city} onChange={updateField('city')} />
                </div>
                <div className="space-y-2">
                  <Label>UF</Label>
                  <Input value={form.state} onChange={updateField('state')} maxLength={2} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label>Rua</Label>
                  <Input value={form.street} onChange={updateField('street')} />
                </div>
                <div className="space-y-2">
                  <Label>Número</Label>
                  <Input value={form.number} onChange={updateField('number')} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Bairro</Label>
                  <Input value={form.neighborhood} onChange={updateField('neighborhood')} />
                </div>
                <div className="space-y-2">
                  <Label>CEP</Label>
                  <Input value={form.zipCode} onChange={updateField('zipCode')} placeholder="00000-000" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={form.isActive}
                  onChange={updateField('isActive')}
                  className="h-4 w-4"
                />
                <Label htmlFor="isActive">Município ativo</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
