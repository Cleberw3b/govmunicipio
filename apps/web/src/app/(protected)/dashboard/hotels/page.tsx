'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Check, ChevronsUpDown, Link2, Plus, Search, Unlink } from 'lucide-react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command, CommandEmpty, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api';

const BR_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

function maskCnpj(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function maskCep(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

interface Hotel {
  id: string;
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
  city: string;
  state: string;
  street: string;
  number: string;
  neighborhood: string;
  zipCode: string;
}

const EMPTY_FORM: CreateForm = {
  name: '', cnpj: '', city: '', state: '',
  street: '', number: '', neighborhood: '', zipCode: '',
};

export default function DashboardHotelsPage() {
  const [linked, setLinked] = useState<Hotel[]>([]);
  const [available, setAvailable] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [linking, setLinking] = useState<string | null>(null);
  const [unlinking, setUnlinking] = useState<string | null>(null);
  const [stateOpen, setStateOpen] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [linkedData, availableData] = await Promise.all([
        apiClient<Hotel[]>('/municipality/hotels'),
        apiClient<Hotel[]>('/municipality/hotels/available'),
      ]);
      setLinked(linkedData);
      setAvailable(availableData);
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function updateField(field: keyof CreateForm) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleCreate() {
    if (!form.name.trim()) return toast.error('Nome é obrigatório.');
    if (!form.cnpj.trim()) return toast.error('CNPJ é obrigatório.');
    setSaving(true);
    try {
      await apiClient('/municipality/hotels', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      toast.success('Hotel criado e vinculado!');
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar hotel');
    } finally {
      setSaving(false);
    }
  }

  async function handleLink(hotelId: string) {
    setLinking(hotelId);
    try {
      await apiClient(`/municipality/hotels/${hotelId}/link`, { method: 'POST' });
      toast.success('Hotel vinculado!');
      const item = available.find((h) => h.id === hotelId);
      setAvailable((prev) => prev.filter((h) => h.id !== hotelId));
      if (item) setLinked((prev) => [...prev, item]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao vincular');
    } finally {
      setLinking(null);
    }
  }

  async function handleUnlink(hotelId: string) {
    setUnlinking(hotelId);
    try {
      await apiClient(`/municipality/hotels/${hotelId}/link`, { method: 'DELETE' });
      toast.success('Hotel desvinculado!');
      const item = linked.find((h) => h.id === hotelId);
      setLinked((prev) => prev.filter((h) => h.id !== hotelId));
      if (item) setAvailable((prev) => [...prev, item]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao desvincular');
    } finally {
      setUnlinking(null);
    }
  }

  const filtered = available.filter((h) =>
    h.organization.name.toLowerCase().includes(search.toLowerCase()) ||
    h.organization.cnpj.includes(search),
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Hotéis</h1>
          <p className="text-muted-foreground">{linked.length} hotel(is) vinculado(s)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setSearch(''); setLinkDialogOpen(true); }}>
            <Link2 className="h-4 w-4" />
            Vincular
          </Button>
          <Button onClick={() => { setForm(EMPTY_FORM); setCreateOpen(true); }}>
            <Plus className="h-4 w-4" />
            Novo Hotel
          </Button>
        </div>
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
                <TableHead className="w-36" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {linked.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nenhum hotel vinculado.
                  </TableCell>
                </TableRow>
              ) : (
                linked.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="font-medium">{h.organization.name}</TableCell>
                    <TableCell className="font-mono text-sm">{h.organization.cnpj}</TableCell>
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
                    <TableCell>
                      <Button
                        variant="outline"
                        className="border-destructive/40 text-destructive hover:bg-destructive hover:text-white"
                        disabled={unlinking === h.id}
                        onClick={() => handleUnlink(h.id)}
                      >
                        <Unlink className="h-4 w-4" />
                        {unlinking === h.id ? 'Desvinculando...' : 'Desvincular'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => { if (!open) setCreateOpen(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Hotel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={updateField('name')} placeholder="Hotel..." />
            </div>
            <div className="space-y-2">
              <Label>CNPJ *</Label>
              <Input
                value={form.cnpj}
                onChange={(e) => setForm((prev) => ({ ...prev, cnpj: maskCnpj(e.target.value) }))}
                placeholder="XX.XXX.XXX/XXXX-XX"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input value={form.city} onChange={updateField('city')} />
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Popover open={stateOpen} onOpenChange={setStateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal"
                    >
                      {form.state || 'Selecione...'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-40 p-0">
                    <Command>
                      <CommandInput placeholder="Filtrar..." />
                      <CommandList>
                        <CommandEmpty>Nenhum resultado.</CommandEmpty>
                        {BR_STATES.map((s) => (
                          <CommandItem
                            key={s}
                            value={s}
                            onSelect={(v) => {
                              setForm((prev) => ({ ...prev, state: v.toUpperCase() }));
                              setStateOpen(false);
                            }}
                          >
                            <Check className={cn('mr-2 h-4 w-4', form.state === s ? 'opacity-100' : 'opacity-0')} />
                            {s}
                          </CommandItem>
                        ))}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
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
                <Input
                  value={form.zipCode}
                  onChange={(e) => setForm((prev) => ({ ...prev, zipCode: maskCep(e.target.value) }))}
                  placeholder="00000-000"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? 'Criando...' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Vincular Hotel Existente</DialogTitle>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por nome ou CNPJ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="max-h-80 overflow-y-auto rounded-md border">
            {filtered.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">
                {available.length === 0
                  ? 'Todos os hotéis já estão vinculados.'
                  : 'Nenhum resultado.'}
              </p>
            ) : (
              <div className="divide-y">
                {filtered.map((h) => (
                  <div key={h.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{h.organization.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {h.organization.cnpj}
                        {h.organization.address && ` · ${h.organization.address.city}/${h.organization.address.state}`}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      disabled={linking === h.id}
                      onClick={() => handleLink(h.id)}
                    >
                      {linking === h.id ? 'Vinculando...' : 'Vincular'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
