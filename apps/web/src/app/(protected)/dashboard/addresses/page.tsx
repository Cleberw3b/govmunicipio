'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/lib/api';

const BR_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

interface PickupAddress {
  id: string;
  name: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
}

const EMPTY_FORM = {
  name: '',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
};

export default function AddressesPage() {
  const [addresses, setAddresses] = useState<PickupAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PickupAddress | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    apiClient<PickupAddress[]>('/municipality/pickup-addresses')
      .then((d) => setAddresses(Array.isArray(d) ? d : []))
      .catch(() => toast.error('Erro ao carregar endereços.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(a: PickupAddress) {
    setEditTarget(a);
    setForm({
      name: a.name,
      street: a.street,
      number: a.number,
      complement: a.complement ?? '',
      neighborhood: a.neighborhood,
      city: a.city,
      state: a.state,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name || !form.street || !form.number || !form.neighborhood || !form.city || !form.state) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }
    setSaving(true);
    try {
      const body = { ...form, complement: form.complement || null };
      if (editTarget) {
        await apiClient(`/municipality/pickup-addresses/${editTarget.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        toast.success('Endereço atualizado.');
      } else {
        await apiClient('/municipality/pickup-addresses', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        toast.success('Endereço criado.');
      }
      setDialogOpen(false);
      load();
    } catch {
      toast.error('Erro ao salvar endereço.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiClient(`/municipality/pickup-addresses/${id}`, { method: 'DELETE' });
      toast.success('Endereço removido.');
      setDeleteId(null);
      load();
    } catch {
      toast.error('Erro ao remover endereço.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Endereços de Embarque</h1>
          <p className="text-sm text-muted-foreground">
            Endereços usados no transporte de pacientes via van, ônibus ou ambulância.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Novo Endereço
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="text-muted-foreground text-sm">Carregando...</span>
        </div>
      ) : addresses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border py-12">
          <p className="text-muted-foreground">Nenhum endereço cadastrado.</p>
          <Button variant="outline" className="mt-4" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Cadastrar endereço
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Endereço</TableHead>
                <TableHead>Bairro</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>UF</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {addresses.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell>{a.street}, {a.number}{a.complement ? ` — ${a.complement}` : ''}</TableCell>
                  <TableCell>{a.neighborhood}</TableCell>
                  <TableCell>{a.city}</TableCell>
                  <TableCell>{a.state}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => openEdit(a)}>
                        <Pencil className="h-4 w-4" />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        className="border-destructive/40 text-destructive hover:bg-destructive hover:text-white"
                        onClick={() => setDeleteId(a.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Remover
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Editar Endereço' : 'Novo Endereço'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome / Referência *</Label>
              <Input
                placeholder="Ex: Posto de Saúde Central"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1">
                <Label>Rua / Avenida *</Label>
                <Input
                  placeholder="Rua das Flores"
                  value={form.street}
                  onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Número *</Label>
                <Input
                  placeholder="123"
                  value={form.number}
                  onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Complemento</Label>
              <Input
                placeholder="Sala 10, fundos..."
                value={form.complement}
                onChange={(e) => setForm((f) => ({ ...f, complement: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Bairro *</Label>
              <Input
                placeholder="Centro"
                value={form.neighborhood}
                onChange={(e) => setForm((f) => ({ ...f, neighborhood: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1">
                <Label>Cidade *</Label>
                <Input
                  placeholder="São Paulo"
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>UF *</Label>
                <Select value={form.state} onValueChange={(v) => setForm((f) => ({ ...f, state: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent>
                    {BR_STATES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remover endereço?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && handleDelete(deleteId)}
            >
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
