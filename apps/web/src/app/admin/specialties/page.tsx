'use client';

import { useCallback, useEffect, useState, useDeferredValue } from 'react';
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

const SIGTAP_GROUPS = [
  { code: '01', name: 'Ações de promoção e prevenção em saúde' },
  { code: '02', name: 'Procedimentos com finalidade diagnóstica' },
  { code: '03', name: 'Procedimentos clínicos' },
  { code: '04', name: 'Procedimentos cirúrgicos' },
  { code: '05', name: 'Transplantes de órgãos, tecidos e células' },
  { code: '06', name: 'Medicamentos' },
  { code: '07', name: 'Órteses, próteses e materiais especiais' },
  { code: '08', name: 'Ações complementares da atenção à saúde' },
  { code: '09', name: 'Procedimentos para Ofertas de Cuidados Integrados' },
];

interface Specialty {
  id: string;
  code: string;
  name: string;
  groupCode: string | null;
  groupName: string | null;
  price: number;
  isActive: boolean;
}

interface CreateForm {
  code: string;
  name: string;
  price: string;
}

interface EditForm {
  name: string;
  price: string;
  isActive: boolean;
}

const EMPTY_CREATE: CreateForm = { code: '', name: '', price: '0' };

export default function SpecialtiesPage() {
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupFilter, setGroupFilter] = useState('');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Specialty | null>(null);
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE);
  const [editForm, setEditForm] = useState<EditForm>({ name: '', price: '0', isActive: true });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    return apiClient<Specialty[]>('/admin/specialties')
      .then((d) => setSpecialties(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function openEdit(s: Specialty) {
    setEditForm({ name: s.name, price: String(Number(s.price).toFixed(2)), isActive: s.isActive });
    setEditTarget(s);
  }

  async function handleCreate() {
    if (!createForm.code.match(/^\d{2}\.\d{2}\.\d{2}\.\d{3}-\d$/)) {
      return toast.error('Código deve seguir o padrão SIGTAP: XX.XX.XX.XXX-X');
    }
    if (!createForm.name.trim()) return toast.error('Descrição é obrigatória.');
    setSaving(true);
    try {
      await apiClient('/admin/specialties', {
        method: 'POST',
        body: JSON.stringify({
          code: createForm.code.trim(),
          name: createForm.name.trim(),
          price: parseFloat(createForm.price) || 0,
        }),
      });
      toast.success('Procedimento criado!');
      setCreateOpen(false);
      setCreateForm(EMPTY_CREATE);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar');
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit() {
    if (!editTarget) return;
    setSaving(true);
    try {
      await apiClient(`/admin/specialties/${editTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editForm.name.trim() || undefined,
          price: parseFloat(editForm.price) || 0,
          isActive: editForm.isActive,
        }),
      });
      toast.success('Procedimento atualizado!');
      setEditTarget(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  const deferredSearch = useDeferredValue(search);
  const deferredGroup = useDeferredValue(groupFilter);
  const hasFilter = !!deferredGroup || deferredSearch.trim().length > 0;

  const filtered = hasFilter
    ? specialties.filter((s) => {
        if (deferredGroup && s.groupCode !== deferredGroup) return false;
        if (deferredSearch) {
          const q = deferredSearch.toLowerCase();
          return s.code.includes(q) || s.name.toLowerCase().includes(q);
        }
        return true;
      })
    : [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Especialidades / Procedimentos SIGTAP</h1>
          <p className="text-muted-foreground">
            {specialties.length} procedimento(s){hasFilter ? ` · mostrando ${filtered.length}` : ''}
          </p>
        </div>
        <Button onClick={() => { setCreateForm(EMPTY_CREATE); setCreateOpen(true); }}>
          <Plus className="h-4 w-4" />
          Novo Procedimento
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <Input
          className="w-72"
          placeholder="Buscar por código ou descrição..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Todos os grupos</option>
          {SIGTAP_GROUPS.map((g) => (
            <option key={g.code} value={g.code}>{g.code} – {g.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando {specialties.length > 0 ? specialties.length : ''}...</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-36">Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead className="w-28 text-right">Valor (R$)</TableHead>
                <TableHead className="w-20">Status</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {!hasFilter ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Selecione um grupo ou use a busca para visualizar procedimentos.
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhum procedimento encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-sm">{s.code}</TableCell>
                    <TableCell className="max-w-xs truncate text-sm">{s.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.groupCode ? `${s.groupCode}` : <span className="italic">—</span>}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {Number(s.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.isActive ? 'default' : 'secondary'}>
                        {s.isActive ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" onClick={() => openEdit(s)}>
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

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => { if (!open) setCreateOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Procedimento SIGTAP</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Código SIGTAP *</Label>
              <Input
                value={createForm.code}
                onChange={(e) => setCreateForm((p) => ({ ...p, code: e.target.value }))}
                placeholder="XX.XX.XX.XXX-X"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">Formato: 01.01.02.001-5</p>
            </div>
            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Input
                value={createForm.name}
                onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ex: CONSULTA MÉDICA EM ATENÇÃO BÁSICA"
              />
            </div>
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={createForm.price}
                onChange={(e) => setCreateForm((p) => ({ ...p, price: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? 'Salvando...' : 'Criar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Procedimento</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <div className="space-y-4">
              <span tabIndex={0} className="sr-only" />
              <div className="rounded-md bg-muted px-3 py-2">
                <p className="font-mono text-sm font-medium">{editTarget.code}</p>
                {editTarget.groupName && (
                  <p className="text-xs text-muted-foreground">{editTarget.groupCode} – {editTarget.groupName}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.price}
                  onChange={(e) => setEditForm((p) => ({ ...p, price: e.target.value }))}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="editActive"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm((p) => ({ ...p, isActive: e.target.checked }))}
                  className="h-4 w-4"
                />
                <Label htmlFor="editActive">Procedimento ativo</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancelar</Button>
            <Button onClick={handleEdit} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
