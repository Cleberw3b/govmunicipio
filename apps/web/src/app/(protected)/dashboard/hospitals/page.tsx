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

interface Hospital {
  id: string;
  cnesCode: string;
  organization: {
    name: string;
    cnpj: string;
    isActive: boolean;
    address: { city: string; state: string } | null;
  };
}

interface CreateForm {
  name: string;
  cnpj: string;
  cnesCode: string;
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
  cnesCode: '',
  city: '',
  state: '',
  street: '',
  number: '',
  neighborhood: '',
  zipCode: '',
};

export default function DashboardHospitalsPage() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    return apiClient<Hospital[]>('/municipality/hospitals')
      .then(setHospitals)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function updateField(field: keyof CreateForm) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleCreate() {
    setSaving(true);
    try {
      await apiClient('/municipality/hospitals', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      toast.success('Hospital criado!');
      setCreating(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar hospital');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Hospitais</h1>
          <p className="text-muted-foreground">{hospitals.length} hospital(is) cadastrado(s)</p>
        </div>
        <Button onClick={() => { setForm(EMPTY_FORM); setCreating(true); }}>
          <Plus className="h-4 w-4" />
          Novo Hospital
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
                <TableHead>CNES</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Cidade/UF</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {hospitals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nenhum hospital cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                hospitals.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="font-medium">{h.organization.name}</TableCell>
                    <TableCell className="font-mono">{h.cnesCode}</TableCell>
                    <TableCell>{h.organization.cnpj}</TableCell>
                    <TableCell>
                      {h.organization.address
                        ? `${h.organization.address.city}/${h.organization.address.state}`
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={h.organization.isActive ? 'default' : 'secondary'}>
                        {h.organization.isActive ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={creating} onOpenChange={(open) => { if (!open) setCreating(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Hospital</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={updateField('name')} placeholder="Hospital Municipal de..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CNPJ *</Label>
                <Input value={form.cnpj} onChange={updateField('cnpj')} placeholder="XX.XXX.XXX/XXXX-XX" />
              </div>
              <div className="space-y-2">
                <Label>Código CNES *</Label>
                <Input value={form.cnesCode} onChange={updateField('cnesCode')} placeholder="0000000" />
              </div>
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
            <Button variant="outline" onClick={() => setCreating(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? 'Criando...' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
