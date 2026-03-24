'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
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
  address: { city: string; state: string } | null;
}

interface CreateForm {
  name: string;
  cnpj: string;
  city: string;
  state: string;
  street: string;
  number: string;
  neighborhood: string;
  zipCode: string;
}

const EMPTY_FORM: CreateForm = {
  name: '',
  cnpj: '',
  city: '',
  state: '',
  street: '',
  number: '',
  neighborhood: '',
  zipCode: '',
};

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    return apiClient<Organization[]>('/municipality/organizations')
      .then((d) => setOrgs(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function updateField(field: keyof CreateForm) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.cnpj.trim()) {
      toast.error('Nome e CNPJ são obrigatórios');
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, string> = { name: form.name, cnpj: form.cnpj };
      if (form.city) body.city = form.city;
      if (form.state) body.state = form.state;
      if (form.street) body.street = form.street;
      if (form.number) body.number = form.number;
      if (form.neighborhood) body.neighborhood = form.neighborhood;
      if (form.zipCode) body.zipCode = form.zipCode;
      await apiClient('/municipality/organizations', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      toast.success('Organização criada!');
      setDialogOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar organização');
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
          <Plus className="mr-2 h-4 w-4" />
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
                <TableHead>Cidade/UF</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Nenhuma organização cadastrada.
                  </TableCell>
                </TableRow>
              ) : (
                orgs.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell className="font-medium">{org.name}</TableCell>
                    <TableCell className="font-mono text-sm">{org.cnpj}</TableCell>
                    <TableCell>
                      {org.address ? `${org.address.city}/${org.address.state}` : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={org.isActive ? 'default' : 'secondary'}>
                        {org.isActive ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Organização</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={updateField('name')} placeholder="Razão social" />
            </div>
            <div className="space-y-2">
              <Label>CNPJ *</Label>
              <Input value={form.cnpj} onChange={updateField('cnpj')} placeholder="XX.XXX.XXX/XXXX-XX" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input value={form.city} onChange={updateField('city')} />
              </div>
              <div className="space-y-2">
                <Label>UF</Label>
                <Input value={form.state} onChange={updateField('state')} maxLength={2} placeholder="BA" />
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
