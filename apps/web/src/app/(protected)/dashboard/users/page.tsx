'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil } from 'lucide-react';
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/lib/api';

interface MunicipalityUser {
  id: string;
  username: string;
  isActive: boolean;
  person: { firstName: string; lastName: string; identification?: { cpf: string } } | null;
  roles: { name: string }[];
}

const ROLE_LABELS: Record<string, string> = {
  admin_municipality: 'Admin Municipal',
  operator_tfd: 'Operador TFD',
  viewer: 'Visualizador',
};

interface UserForm {
  username: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  cpf: string;
  role: string;
  isActive: boolean;
}

const emptyForm: UserForm = {
  username: '',
  email: '',
  phone: '',
  firstName: '',
  lastName: '',
  cpf: '',
  role: 'operator_tfd',
  isActive: true,
};

export default function DashboardUsersPage() {
  const [users, setUsers] = useState<MunicipalityUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingUsername, setEditingUsername] = useState<string>('');
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [createdOtp, setCreatedOtp] = useState<{ username: string; code: string } | null>(null);
  const [sendingOtp, setSendingOtp] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    return apiClient<Record<string, unknown>[]>('/municipality/users')
      .then((data) => {
        const mapped = (data ?? []).map((u) => ({
          id: u.id as string,
          username: u.username as string,
          isActive: u.isActive as boolean,
          person: u.person as MunicipalityUser['person'],
          roles: (
            (u.roles as { name: string }[]) ??
            ((u.roleLinks as { role: { name: string } }[]) ?? []).map((rl) => rl.role)
          ),
        }));
        setUsers(mapped);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(u: MunicipalityUser) {
    setEditingId(u.id);
    setEditingUsername(u.username);
    setForm({
      username: u.username,
      email: '',
      phone: '',
      firstName: u.person?.firstName ?? '',
      lastName: u.person?.lastName ?? '',
      cpf: u.person?.identification?.cpf ?? '',
      role: u.roles[0]?.name ?? 'operator_tfd',
      isActive: u.isActive,
    });
    setDialogOpen(true);
  }

  function updateField(field: keyof UserForm) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  }

  async function handleSendOtp(username: string) {
    setSendingOtp(true);
    try {
      const result = await apiClient<{ code: string }>('/auth/otp/request', {
        method: 'POST',
        body: JSON.stringify({ username }),
      });
      setCreatedOtp({ username, code: result.code });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar OTP');
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editingId) {
        const body: Record<string, unknown> = {
          username: form.username,
          firstName: form.firstName,
          lastName: form.lastName,
          role: form.role,
          isActive: form.isActive,
        };
        if (form.cpf) body.cpf = form.cpf;
        await apiClient(`/municipality/users/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        toast.success('Usuário atualizado!');
        setDialogOpen(false);
        load();
      } else {
        const body: Record<string, unknown> = {
          username: form.username,
          firstName: form.firstName,
          lastName: form.lastName,
          cpf: form.cpf,
          role: form.role,
        };
        if (form.email) body.email = form.email;
        if (form.phone) body.phone = form.phone;
        const result = await apiClient<{ user: MunicipalityUser; otpCode: string }>('/municipality/users', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        setDialogOpen(false);
        setCreatedOtp({ username: form.username, code: result.otpCode });
        load();
      }
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
          <h1 className="text-2xl font-bold">Usuários do Município</h1>
          <p className="text-muted-foreground">{users.length} usuário(s)</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
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
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nenhum usuário cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-mono font-medium">{u.username}</TableCell>
                    <TableCell>
                      {u.person ? `${u.person.firstName} ${u.person.lastName}` : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(u.roles ?? []).map((r) => (
                          <Badge key={r.name} variant="outline">
                            {ROLE_LABELS[r.name] ?? r.name}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.isActive ? 'default' : 'secondary'}>
                        {u.isActive ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" onClick={() => openEdit(u)}>
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

      {/* OTP result dialog */}
      <Dialog open={!!createdOtp} onOpenChange={(open) => { if (!open) setCreatedOtp(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Código OTP Gerado</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Compartilhe o código abaixo com o usuário <strong>{createdOtp?.username}</strong>. Ele deve acessar <strong>/auth/set-password</strong> para definir sua senha.
            </p>
            <div className="flex items-center justify-center rounded-lg bg-muted py-4">
              <span className="font-mono text-3xl font-bold tracking-widest">{createdOtp?.code}</span>
            </div>
            <p className="text-xs text-muted-foreground text-center">O código expira em 15 minutos.</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setCreatedOtp(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle>
          </DialogHeader>
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
              <Input value={form.username} onChange={updateField('username')} placeholder="operador_cidade" />
            </div>
            {!editingId && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input type="email" value={form.email} onChange={updateField('email')} placeholder="usuario@exemplo.com" />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input type="tel" value={form.phone} onChange={updateField('phone')} placeholder="(11) 99999-9999" />
                </div>
              </div>
            )}
            {editingId && (
              <div className="space-y-2">
                <Label>Senha</Label>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={sendingOtp}
                  onClick={() => handleSendOtp(editingUsername)}
                >
                  {sendingOtp ? 'Gerando OTP...' : 'Enviar OTP para redefinir senha'}
                </Button>
              </div>
            )}
            <div className="space-y-2">
              <Label>Função</Label>
              <Select value={form.role} onValueChange={(v) => setForm((p) => ({ ...p, role: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin_municipality">Admin Municipal</SelectItem>
                  <SelectItem value="operator_tfd">Operador TFD</SelectItem>
                  <SelectItem value="viewer">Visualizador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editingId && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="muserActive"
                  checked={form.isActive}
                  onChange={updateField('isActive')}
                  className="h-4 w-4"
                />
                <Label htmlFor="muserActive">Usuário ativo</Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : editingId ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
