'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { apiClient } from '@/lib/api';

interface MunicipalityData {
  name: string;
  cnpj: string;
  ibgeCode: string;
  state: string;
  city: string;
  street: string;
  number: string;
  neighborhood: string;
  zipCode: string;
}

interface AdminData {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  cpf: string;
}

const emptyMunicipality: MunicipalityData = {
  name: '',
  cnpj: '',
  ibgeCode: '',
  state: '',
  city: '',
  street: '',
  number: '',
  neighborhood: '',
  zipCode: '',
};

const emptyAdmin: AdminData = {
  username: '',
  password: '',
  firstName: '',
  lastName: '',
  cpf: '',
};

export default function NewMunicipalityPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [mData, setMData] = useState<MunicipalityData>(emptyMunicipality);
  const [aData, setAData] = useState<AdminData>(emptyAdmin);
  const [loading, setLoading] = useState(false);

  function updateM(field: keyof MunicipalityData) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setMData((prev) => ({ ...prev, [field]: e.target.value }));
  }

  function updateA(field: keyof AdminData) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setAData((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      await apiClient('/admin/municipalities', {
        method: 'POST',
        body: JSON.stringify({ municipality: mData, admin: aData }),
      });
      toast.success('Município criado com sucesso!');
      router.push('/admin/municipalities');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Erro ao criar município',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Novo Município</h1>
        <div className="mt-3 flex items-center gap-3">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                  step > s
                    ? 'bg-primary text-primary-foreground'
                    : step === s
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-muted-foreground text-muted-foreground'
                }`}
              >
                {step > s ? <Check className="h-3 w-3" /> : s}
              </div>
              <span
                className={`text-sm ${step === s ? 'font-medium' : 'text-muted-foreground'}`}
              >
                {s === 1 ? 'Dados do Município' : 'Administrador'}
              </span>
              {s < 2 && <div className="h-px w-8 bg-border" />}
            </div>
          ))}
        </div>
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Dados do Município</CardTitle>
            <CardDescription>
              Informações da prefeitura municipal
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Prefeitura</Label>
              <Input
                id="name"
                value={mData.name}
                onChange={updateM('name')}
                placeholder="Prefeitura Municipal de..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input
                  id="cnpj"
                  value={mData.cnpj}
                  onChange={updateM('cnpj')}
                  placeholder="XX.XXX.XXX/XXXX-XX"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ibgeCode">Código IBGE</Label>
                <Input
                  id="ibgeCode"
                  value={mData.ibgeCode}
                  onChange={updateM('ibgeCode')}
                  placeholder="7 dígitos"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  value={mData.city}
                  onChange={updateM('city')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">UF</Label>
                <Input
                  id="state"
                  value={mData.state}
                  onChange={updateM('state')}
                  maxLength={2}
                  placeholder="BA"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="street">Rua</Label>
                <Input
                  id="street"
                  value={mData.street}
                  onChange={updateM('street')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="number">Número</Label>
                <Input
                  id="number"
                  value={mData.number}
                  onChange={updateM('number')}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="neighborhood">Bairro</Label>
                <Input
                  id="neighborhood"
                  value={mData.neighborhood}
                  onChange={updateM('neighborhood')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zipCode">CEP</Label>
                <Input
                  id="zipCode"
                  value={mData.zipCode}
                  onChange={updateM('zipCode')}
                  placeholder="00000-000"
                />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={() => setStep(2)}>
                Próximo <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Primeiro Administrador</CardTitle>
            <CardDescription>
              Usuário admin_municipality para este município
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Nome</Label>
                <Input
                  id="firstName"
                  value={aData.firstName}
                  onChange={updateA('firstName')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Sobrenome</Label>
                <Input
                  id="lastName"
                  value={aData.lastName}
                  onChange={updateA('lastName')}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cpf">CPF</Label>
              <Input
                id="cpf"
                value={aData.cpf}
                onChange={updateA('cpf')}
                placeholder="000.000.000-00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Nome de Usuário</Label>
              <Input
                id="username"
                value={aData.username}
                onChange={updateA('username')}
                placeholder="admin_cidade"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha (mínimo 8 caracteres)</Label>
              <Input
                id="password"
                type="password"
                value={aData.password}
                onChange={updateA('password')}
              />
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
              </Button>
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? 'Criando...' : 'Criar Município'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
