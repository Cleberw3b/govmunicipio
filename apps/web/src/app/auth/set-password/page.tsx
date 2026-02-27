'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, CheckCircle2, XCircle } from 'lucide-react';
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

type Step = 'otp' | 'password';

interface PasswordRequirement {
  label: string;
  met: boolean;
}

function getPasswordRequirements(password: string): PasswordRequirement[] {
  return [
    { label: 'Mínimo 8 caracteres', met: password.length >= 8 },
    { label: 'Letra maiúscula', met: /[A-Z]/.test(password) },
    { label: 'Letra minúscula', met: /[a-z]/.test(password) },
    { label: 'Número', met: /\d/.test(password) },
    { label: 'Caractere especial', met: /[^A-Za-z0-9]/.test(password) },
  ];
}

export default function SetPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('otp');

  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const requirements = getPasswordRequirements(newPassword);
  const passwordStrong = requirements.every((r) => r.met);

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (code.length !== 6) {
      setError('O código OTP deve ter 6 dígitos.');
      return;
    }

    setStep('password');
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!passwordStrong) {
      setError('A senha não atende todos os requisitos.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setIsLoading(true);
    try {
      await apiClient('/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ username, code, newPassword }),
      });
      router.push('/auth/login?message=Senha definida com sucesso');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Código inválido ou expirado.',
      );
      setStep('otp');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Building2 className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">Definir Senha</CardTitle>
          <CardDescription>
            {step === 'otp'
              ? 'Informe seu usuário e o código OTP recebido'
              : 'Crie uma senha forte para sua conta'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {step === 'otp' && (
            <form onSubmit={handleOtpSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="username">Usuário</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Digite seu usuário"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="code">Código OTP</Label>
                <Input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  placeholder="000000"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                Continuar
              </Button>
              <Button
                type="button"
                variant="link"
                className="w-full"
                onClick={() => router.push('/auth/login')}
              >
                Voltar ao login
              </Button>
            </form>
          )}

          {step === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-password">Nova Senha</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Digite sua nova senha"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>

              <div className="rounded-md border bg-muted/50 p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Requisitos da senha:
                </p>
                <ul className="flex flex-col gap-1">
                  {requirements.map((req) => (
                    <li key={req.label} className="flex items-center gap-2 text-xs">
                      {req.met ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      <span className={req.met ? 'text-green-700' : 'text-muted-foreground'}>
                        {req.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="confirm-password">Confirmar Senha</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Confirme sua nova senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-destructive">As senhas não coincidem</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !passwordStrong || newPassword !== confirmPassword}
              >
                {isLoading ? 'Salvando...' : 'Definir Senha'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setStep('otp')}
                disabled={isLoading}
              >
                Voltar
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
