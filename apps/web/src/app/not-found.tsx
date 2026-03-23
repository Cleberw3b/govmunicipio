import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex h-screen items-center justify-center px-4">
      <div className="max-w-md space-y-6 text-center" role="main" aria-labelledby="not-found-title">
        <div className="flex justify-center">
          <div className="rounded-full bg-muted p-4" aria-hidden="true">
            <AlertCircle className="h-12 w-12 text-muted-foreground" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 id="not-found-title" className="text-4xl font-bold">404</h1>
          <h2 className="text-2xl font-semibold">Página não encontrada</h2>
          <p className="text-sm text-muted-foreground">
            Desculpe-nos, a página que você está procurando não existe ou foi movida.
          </p>
        </div>

        <Button asChild className="w-full">
          <Link href="/dashboard">Voltar ao início</Link>
        </Button>
      </div>
    </div>
  );
}
