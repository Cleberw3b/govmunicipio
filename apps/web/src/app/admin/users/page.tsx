'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Check, ChevronsUpDown, Pencil, Plus } from 'lucide-react';
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
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api';

interface Principal {
  id: string;
  username: string;
  isActive: boolean;
  person: { firstName: string; lastName: string; identification?: { cpf: string } } | null;
  roles: { name: string }[];
  organizations: { id: string; name: string }[];
}

interface MunicipalityResponse {
  id: string;
  state: string;
  organization: {
    id: string;
    name: string;
    address: { city: string; state: string } | null;
  };
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin_municipality: 'Admin Municipal',
  operator_tfd: 'Operador TFD',
  viewer: 'Visualizador',
};

const ALL_ROLES = ['super_admin', 'admin_municipality', 'operator_tfd', 'viewer'];

interface EditForm {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  cpf: string;
  isActive: boolean;
  roles: string[];
  organizationId: string | null;
}

interface CreateForm {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  cpf: string;
  roles: string[];
  organizationId: string | null;
}

const EMPTY_CREATE: CreateForm = {
  username: '',
  password: '',
  firstName: '',
  lastName: '',
  cpf: '',
  roles: [],
  organizationId: null,
};

export default function UsersPage() {
  const [users, setUsers] = useState<Principal[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Principal | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE);
  const [saving, setSaving] = useState(false);
  const [municipalities, setMunicipalities] = useState<{ orgId: string; label: string }[]>([]);
  const [editComboOpen, setEditComboOpen] = useState(false);
  const [createComboOpen, setCreateComboOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    return apiClient<Principal[]>('/admin/users')
      .then(setUsers)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function loadMunicipalities() {
    if (municipalities.length === 0) {
      apiClient<MunicipalityResponse[]>('/admin/municipalities')
        .then((data) =>
          setMunicipalities(
            data.map((m) => ({
              orgId: m.organization.id,
              label: `${m.organization.name} — ${m.organization.address?.city ?? ''}/${m.state}`,
            })),
          ),
        )
        .catch(console.error);
    }
  }

  function openCreate() {
    setCreateForm(EMPTY_CREATE);
    setCreating(true);
    loadMunicipalities();
  }

  function openEdit(u: Principal) {
    setEditing(u);
    setForm({
      username: u.username,
      password: '',
      firstName: u.person?.firstName ?? '',
      lastName: u.person?.lastName ?? '',
      cpf: u.person?.identification?.cpf ?? '',
      isActive: u.isActive,
      roles: u.roles.map((r) => r.name),
      organizationId: u.organizations[0]?.id ?? null,
    });
    loadMunicipalities();
  }

  function updateEditField(field: keyof EditForm) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => prev ? { ...prev, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value } : prev);
  }

  function updateCreateField(field: keyof CreateForm) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setCreateForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  function toggleEditRole(role: string) {
    setForm((prev) => {
      if (!prev) return prev;
      const roles = prev.roles.includes(role)
        ? prev.roles.filter((r) => r !== role)
        : [...prev.roles, role];
      return { ...prev, roles };
    });
  }

  function toggleCreateRole(role: string) {
    setCreateForm((prev) => {
      const roles = prev.roles.includes(role)
        ? prev.roles.filter((r) => r !== role)
        : [...prev.roles, role];
      return { ...prev, roles };
    });
  }

  const isSuperAdminCreate = createForm.roles.includes('super_admin');
  const requiresPersonCreate = !isSuperAdminCreate && createForm.roles.length > 0;

  async function handleCreate() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        username: createForm.username,
        password: createForm.password,
        roles: createForm.roles,
      };
      if (!isSuperAdminCreate) {
        body.firstName = createForm.firstName;
        body.lastName = createForm.lastName;
        body.cpf = createForm.cpf;
      }
      if (createForm.organizationId) body.organizationId = createForm.organizationId;

      await apiClient('/admin/users', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      toast.success('Usuário criado!');
      setCreating(false);
      setCreateComboOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar');
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (!editing || !form) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        username: form.username,
        firstName: form.firstName,
        lastName: form.lastName,
        cpf: form.cpf,
        isActive: form.isActive,
        roles: form.roles,
      };
      if (form.password) body.password = form.password;
      const originalOrgId = editing.organizations[0]?.id ?? null;
      if (form.organizationId !== originalOrgId) {
        body.organizationId = form.organizationId;
      }
      await apiClient(`/admin/users/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      toast.success('Usuário atualizado!');
      setEditing(null);
      setEditComboOpen(false);
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
          <h1 className="text-2xl font-bold">Usuários</h1>
          <p className="text-muted-foreground">{users.length} usuário(s) cadastrado(s)</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Novo Usuário
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Organização</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-mono font-medium">{u.username}</TableCell>
                  <TableCell>
                    {u.person ? `${u.person.firstName} ${u.person.lastName}` : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((r) => (
                        <Badge key={r.name} variant="outline">
                          {ROLE_LABELS[r.name] ?? r.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {u.organizations.length > 0 ? (
                      u.organizations[0].name
                    ) : (
                      <span className="italic text-muted-foreground">Plataforma</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.isActive ? 'default' : 'secondary'}>
                      {u.isActive ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={creating} onOpenChange={(open) => { if (!open) { setCreating(false); setCreateComboOpen(false); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Roles</Label>
              <div className="flex flex-wrap gap-3">
                {ALL_ROLES.map((role) => (
                  <label key={role} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={createForm.roles.includes(role)}
                      onChange={() => toggleCreateRole(role)}
                      className="h-4 w-4"
                    />
                    {ROLE_LABELS[role]}
                  </label>
                ))}
              </div>
            </div>

            {requiresPersonCreate && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome *</Label>
                    <Input value={createForm.firstName} onChange={updateCreateField('firstName')} />
                  </div>
                  <div className="space-y-2">
                    <Label>Sobrenome *</Label>
                    <Input value={createForm.lastName} onChange={updateCreateField('lastName')} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>CPF *</Label>
                  <Input value={createForm.cpf} onChange={updateCreateField('cpf')} placeholder="000.000.000-00" />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Nome de Usuário *</Label>
              <Input value={createForm.username} onChange={updateCreateField('username')} />
            </div>
            <div className="space-y-2">
              <Label>Senha *</Label>
              <Input type="password" value={createForm.password} onChange={updateCreateField('password')} />
            </div>

            <div className="space-y-2">
              <Label>Organização</Label>
              <Popover open={createComboOpen} onOpenChange={setCreateComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={createComboOpen}
                    className="w-full justify-between font-normal"
                  >
                    {createForm.organizationId
                      ? municipalities.find((m) => m.orgId === createForm.organizationId)?.label ?? 'Carregando...'
                      : 'Sem organização'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                  <Command>
                    <CommandInput placeholder="Buscar município..." />
                    <CommandList>
                      <CommandEmpty>Nenhum município encontrado.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="__none__"
                          onSelect={() => {
                            setCreateForm((prev) => ({ ...prev, organizationId: null }));
                            setCreateComboOpen(false);
                          }}
                        >
                          <Check className={cn('mr-2 h-4 w-4', createForm.organizationId === null ? 'opacity-100' : 'opacity-0')} />
                          Sem organização
                        </CommandItem>
                        {municipalities.map((m) => (
                          <CommandItem
                            key={m.orgId}
                            value={m.label}
                            onSelect={() => {
                              setCreateForm((prev) => ({ ...prev, organizationId: m.orgId }));
                              setCreateComboOpen(false);
                            }}
                          >
                            <Check className={cn('mr-2 h-4 w-4', createForm.organizationId === m.orgId ? 'opacity-100' : 'opacity-0')} />
                            {m.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreating(false); setCreateComboOpen(false); }}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? 'Criando...' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) { setEditing(null); setEditComboOpen(false); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input value={form.firstName} onChange={updateEditField('firstName')} />
                </div>
                <div className="space-y-2">
                  <Label>Sobrenome</Label>
                  <Input value={form.lastName} onChange={updateEditField('lastName')} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>CPF</Label>
                <Input value={form.cpf} onChange={updateEditField('cpf')} placeholder="000.000.000-00" />
              </div>
              <div className="space-y-2">
                <Label>Nome de Usuário</Label>
                <Input value={form.username} onChange={updateEditField('username')} />
              </div>
              <div className="space-y-2">
                <Label>Nova Senha (deixe em branco para manter)</Label>
                <Input type="password" value={form.password} onChange={updateEditField('password')} />
              </div>
              <div className="space-y-2">
                <Label>Roles</Label>
                <div className="flex flex-wrap gap-3">
                  {ALL_ROLES.map((role) => (
                    <label key={role} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.roles.includes(role)}
                        onChange={() => toggleEditRole(role)}
                        className="h-4 w-4"
                      />
                      {ROLE_LABELS[role]}
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Organização</Label>
                <Popover open={editComboOpen} onOpenChange={setEditComboOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={editComboOpen}
                      className="w-full justify-between font-normal"
                    >
                      {form.organizationId
                        ? municipalities.find((m) => m.orgId === form.organizationId)?.label ?? 'Carregando...'
                        : 'Sem organização'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                    <Command>
                      <CommandInput placeholder="Buscar município..." />
                      <CommandList>
                        <CommandEmpty>Nenhum município encontrado.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="__none__"
                            onSelect={() => {
                              setForm((prev) => prev ? { ...prev, organizationId: null } : prev);
                              setEditComboOpen(false);
                            }}
                          >
                            <Check className={cn('mr-2 h-4 w-4', form.organizationId === null ? 'opacity-100' : 'opacity-0')} />
                            Sem organização
                          </CommandItem>
                          {municipalities.map((m) => (
                            <CommandItem
                              key={m.orgId}
                              value={m.label}
                              onSelect={() => {
                                setForm((prev) => prev ? { ...prev, organizationId: m.orgId } : prev);
                                setEditComboOpen(false);
                              }}
                            >
                              <Check className={cn('mr-2 h-4 w-4', form.organizationId === m.orgId ? 'opacity-100' : 'opacity-0')} />
                              {m.label}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="userActive"
                  checked={form.isActive}
                  onChange={updateEditField('isActive')}
                  className="h-4 w-4"
                />
                <Label htmlFor="userActive">Usuário ativo</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditing(null); setEditComboOpen(false); }}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
