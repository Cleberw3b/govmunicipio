'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Plus } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { apiClient } from '@/lib/api';

interface Organization {
  id: string;
  name: string;
  cnpj: string;
  isActive: boolean;
  address: {
    city: string;
    state: string;
    street?: string;
    number?: string;
    neighborhood?: string;
    zipCode?: string;
  } | null;
}

interface OrgForm {
  name: string;
  cnpj: string;
  city: string;
  state: string;
  street: string;
  number: string;
  neighborhood: string;
  zipCode: string;
  isActive: boolean;
}

const EMPTY_FORM: OrgForm = {
  name: '',
  cnpj: '',
  city: '',
  state: '',
  street: '',
  number: '',
  neighborhood: '',
  zipCode: '',
  isActive: true,
};

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<OrgForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    return apiClient<Organization[]>('/admin/organizations')
      .then(setOrgs)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setDialogMode('create');
  }

  function openEdit(org: Organization) {
    setForm({
      name: org.name,
      cnpj: org.cnpj,
      city: org.address?.city ?? '',
      state: org.address?.state ?? '',
      street: org.address?.street ?? '',
      number: org.address?.number ?? '',
      neighborhood: org.address?.neighborhood ?? '',
      zipCode: org.address?.zipCode ?? '',
      isActive: org.isActive,
    });
    setEditingId(org.id);
    setDialogMode('edit');
  }

  function closeDialog() {
    setDialogMode(null);
    setEditingId(null);
  }

  function updateField(field: keyof OrgForm) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({
        ...prev,
        [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value,
      }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (dialogMode === 'create') {
        await apiClient('/admin/organizations', {
          method: 'POST',
          body: JSON.stringify({
            name: form.name,
            cnpj: form.cnpj,
            ...(form.city || form.state || form.street ? {
              city: form.city || undefined,
              state: form.state || undefined,
              street: form.street || undefined,
              number: form.number || undefined,
              neighborhood: form.neighborhood || undefined,
              zipCode: form.zipCode || undefined,
            } : {}),
          }),
        });
        toast.success('Organização criada!');
      } else {
        const body: Record<string, unknown> = {};
        if (form.name) body.name = form.name;
        if (form.cnpj) body.cnpj = form.cnpj;
        body.isActive = form.isActive;
        if (form.city) body.city = form.city;
        if (form.state) body.state = form.state;
        if (form.street) body.street = form.street;
        if (form.number) body.number = form.number;
        if (form.neighborhood) body.neighborhood = form.neighborhood;
        if (form.zipCode) body.zipCode = form.zipCode;
        await apiClient(`/admin/organizations/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        toast.success('Organização atualizada!');
      }
      closeDialog();
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Organizações</h1>
          <p className="text-muted-foreground">{orgs.length} organização(ões) cadastrada(s)</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nova Organização
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
                <TableHead>Cidade/Estado</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgs.map((org) => (
                <TableRow key={org.id}>
                  <TableCell className="font-medium">{org.name}</TableCell>
                  <TableCell className="font-mono text-sm">{org.cnpj}</TableCell>
                  <TableCell>
                    {org.address
                      ? `${org.address.city}/${org.address.state}`
                      : <span className="italic text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={org.isActive ? 'default' : 'secondary'}>
                      {org.isActive ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" onClick={() => openEdit(org)}>
                      <Pencil className="h-4 w-4" />
                        Editar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!dialogMode} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'create' ? 'Nova Organização' : 'Editar Organização'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={updateField('name')} />
            </div>
            <div className="space-y-2">
              <Label>CNPJ *</Label>
              <Input value={form.cnpj} onChange={updateField('cnpj')} placeholder="XX.XXX.XXX/XXXX-XX" />
            </div>

            <p className="text-sm font-medium text-muted-foreground">Endereço (opcional)</p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input value={form.city} onChange={updateField('city')} />
              </div>
              <div className="space-y-2">
                <Label>Estado (UF)</Label>
                <Input value={form.state} onChange={updateField('state')} maxLength={2} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Logradouro</Label>
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
                <Input value={form.zipCode} onChange={updateField('zipCode')} />
              </div>
            </div>

            {dialogMode === 'edit' && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="orgActive"
                  checked={form.isActive}
                  onChange={updateField('isActive')}
                  className="h-4 w-4"
                />
                <Label htmlFor="orgActive">Organização ativa</Label>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
