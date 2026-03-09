'use client';

import { useCallback, useEffect, useRef, useState, useDeferredValue } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Plus, X } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  isActive: boolean;
}

interface Hospital {
  id: string;
  cnesCode: string;
  specialties: Specialty[];
  organization: { name: string };
}

export default function HospitalSpecialtiesPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [allSpecialties, setAllSpecialties] = useState<Specialty[]>([]);
  const [loadingHospital, setLoadingHospital] = useState(true);
  const [loadingSpecialties, setLoadingSpecialties] = useState(false);
  const specialtiesLoaded = useRef(false);
  const [linking, setLinking] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [group, setGroup] = useState('');
  const deferredSearch = useDeferredValue(search);
  const deferredGroup = useDeferredValue(group);
  const hasFilter = !!deferredGroup || deferredSearch.trim().length >= 2;

  // Load hospital + its linked specialties
  const loadHospital = useCallback(() => {
    setLoadingHospital(true);
    apiClient<Hospital>(`/admin/hospitals/${id}/specialties`)
      .then((data) => setHospital({ ...data, specialties: data.specialties ?? [] }))
      .catch(() => toast.error('Erro ao carregar hospital'))
      .finally(() => setLoadingHospital(false));
  }, [id]);

  useEffect(() => { loadHospital(); }, [loadHospital]);

  // Lazy-load all specialties on first filter interaction
  useEffect(() => {
    if (!hasFilter || specialtiesLoaded.current) return;
    setLoadingSpecialties(true);
    apiClient<Specialty[]>('/admin/specialties')
      .then((data) => {
        setAllSpecialties(data.filter((s) => s.isActive));
        specialtiesLoaded.current = true;
      })
      .catch(console.error)
      .finally(() => setLoadingSpecialties(false));
  }, [hasFilter]);

  const linkedIds = new Set((hospital?.specialties ?? []).map((s) => s.id));

  const filteredAvailable = hasFilter && !loadingSpecialties
    ? allSpecialties.filter((s) => {
        if (linkedIds.has(s.id)) return false;
        if (deferredGroup && s.groupCode !== deferredGroup) return false;
        if (deferredSearch.trim()) {
          const q = deferredSearch.toLowerCase();
          return s.code.includes(q) || s.name.toLowerCase().includes(q);
        }
        return true;
      })
    : [];

  async function handleLink(specialtyId: string) {
    if (!hospital) return;
    setLinking(specialtyId);
    try {
      await apiClient(`/admin/hospitals/${hospital.id}/specialties/${specialtyId}`, { method: 'POST' });
      const spec = allSpecialties.find((s) => s.id === specialtyId);
      if (spec) {
        setHospital((prev) => prev ? { ...prev, specialties: [...prev.specialties, spec] } : prev);
      }
      toast.success('Especialidade vinculada!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao vincular');
    } finally {
      setLinking(null);
    }
  }

  async function handleUnlink(specialtyId: string) {
    if (!hospital) return;
    setLinking(specialtyId);
    try {
      await apiClient(`/admin/hospitals/${hospital.id}/specialties/${specialtyId}`, { method: 'DELETE' });
      setHospital((prev) =>
        prev ? { ...prev, specialties: prev.specialties.filter((s) => s.id !== specialtyId) } : prev,
      );
      toast.success('Especialidade removida!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover');
    } finally {
      setLinking(null);
    }
  }

  if (loadingHospital) {
    return <p className="text-muted-foreground">Carregando...</p>;
  }

  if (!hospital) {
    return <p className="text-destructive">Hospital não encontrado.</p>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => router.push('/admin/hospitals')}>
          <ArrowLeft className="h-4 w-4" />
          Voltar para Hospitais
        </Button>
        <h1 className="text-2xl font-bold">{hospital.organization.name}</h1>
        <p className="text-muted-foreground">Gerenciar especialidades / procedimentos SIGTAP</p>
      </div>

      {/* Linked specialties */}
      <div className="rounded-lg border p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Especialidades Vinculadas</h2>
          <span className="text-sm text-muted-foreground">{hospital.specialties.length} vinculada(s)</span>
        </div>

        {hospital.specialties.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma especialidade vinculada.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-36">Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {hospital.specialties.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-sm">{s.code}</TableCell>
                  <TableCell className="text-sm">{s.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.groupCode ?? '—'}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={linking === s.id}
                      onClick={() => handleUnlink(s.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Add specialties */}
      <div className="rounded-lg border p-4">
        <h2 className="mb-3 font-semibold">Adicionar Especialidade</h2>

        <div className="mb-4 flex flex-wrap gap-3">
          <select
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Selecione um grupo...</option>
            {SIGTAP_GROUPS.map((g) => (
              <option key={g.code} value={g.code}>{g.code} – {g.name}</option>
            ))}
          </select>
          <Input
            className="w-72"
            placeholder="Buscar por código ou descrição (mín. 2 chars)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {!hasFilter ? (
          <p className="text-sm text-muted-foreground">
            Selecione um grupo ou digite pelo menos 2 caracteres para buscar procedimentos.
          </p>
        ) : loadingSpecialties ? (
          <p className="text-sm text-muted-foreground">Carregando procedimentos...</p>
        ) : filteredAvailable.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum procedimento disponível com esse filtro.</p>
        ) : (
          <>
            <p className="mb-2 text-sm text-muted-foreground">{filteredAvailable.length} procedimento(s) encontrado(s)</p>
            <div className="rounded-md border overflow-hidden">
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead className="w-36">Código</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAvailable.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono text-sm">{s.code}</TableCell>
                        <TableCell className="text-sm">{s.name}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={linking === s.id}
                            onClick={() => handleLink(s.id)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
