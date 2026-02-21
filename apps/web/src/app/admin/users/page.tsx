'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Check, ChevronsUpDown, Pencil } from 'lucide-react';
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

export default function UsersPage() {
  const [users, setUsers] = useState<Principal[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Principal | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [municipalities, setMunicipalities] = useState<{ orgId: string; label: string }[]>([]);
  const [comboOpen, setComboOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    return apiClient<Principal[]>('/admin/users')
      .then(setUsers)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

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

  function updateField(field: keyof EditForm) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => prev ? { ...prev, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value } : prev);
  }

  function toggleRole(role: string) {
    setForm((prev) => {
      if (!prev) return prev;
      const roles = prev.roles.includes(role)
        ? prev.roles.filter((r) => r !== role)
        : [...prev.roles, role];
      return { ...prev, roles };
    });
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
      setComboOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Usuários</h1>
        <p className="text-muted-foreground">{users.length} usuário(s) cadastrado(s)</p>
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

      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) { setEditing(null); setComboOpen(false); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input value={form.firstName} onChange={updateField('firstName')} />
                </div>
                <div className="space-y-2">
                  <Label>Sobrenome</Label>
                  <Input value={form.lastName} onChange={updateField('lastName')} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>CPF</Label>
                <Input value={form.cpf} onChange={updateField('cpf')} placeholder="000.000.000-00" />
              </div>
              <div className="space-y-2">
                <Label>Nome de Usuário</Label>
                <Input value={form.username} onChange={updateField('username')} />
              </div>
              <div className="space-y-2">
                <Label>Nova Senha (deixe em branco para manter)</Label>
                <Input type="password" value={form.password} onChange={updateField('password')} />
              </div>
              <div className="space-y-2">
                <Label>Roles</Label>
                <div className="flex flex-wrap gap-3">
                  {ALL_ROLES.map((role) => (
                    <label key={role} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.roles.includes(role)}
                        onChange={() => toggleRole(role)}
                        className="h-4 w-4"
                      />
                      {ROLE_LABELS[role]}
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Organização</Label>
                <Popover open={comboOpen} onOpenChange={setComboOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={comboOpen}
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
                              setComboOpen(false);
                            }}
                          >
                            <Check
                              className={cn('mr-2 h-4 w-4', form.organizationId === null ? 'opacity-100' : 'opacity-0')}
                            />
                            Sem organização
                          </CommandItem>
                          {municipalities.map((m) => (
                            <CommandItem
                              key={m.orgId}
                              value={m.label}
                              onSelect={() => {
                                setForm((prev) => prev ? { ...prev, organizationId: m.orgId } : prev);
                                setComboOpen(false);
                              }}
                            >
                              <Check
                                className={cn('mr-2 h-4 w-4', form.organizationId === m.orgId ? 'opacity-100' : 'opacity-0')}
                              />
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
                  onChange={updateField('isActive')}
                  className="h-4 w-4"
                />
                <Label htmlFor="userActive">Usuário ativo</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditing(null); setComboOpen(false); }}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
