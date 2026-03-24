'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="flex h-screen items-center justify-center px-4">
      <div className="max-w-md space-y-6 text-center" role="alert" aria-labelledby="error-title">
        <div className="flex justify-center">
          <div className="rounded-full bg-destructive/10 p-4" aria-hidden="true">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 id="error-title" className="text-2xl font-semibold">Erro inesperado</h1>
          <p className="text-sm text-muted-foreground">
            Desculpe-nos. Algo deu errado ao carregar a página.
          </p>
          {/* Never expose error messages/stack traces to users */}
        </div>

        <Button onClick={reset} className="w-full">
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}
