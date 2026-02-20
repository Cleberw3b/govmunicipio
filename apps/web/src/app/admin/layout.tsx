'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Building2, Users, LayoutDashboard, LogOut, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { isAuthenticated, logout } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/admin-auth';

const adminNav = [
  { name: 'Municípios', href: '/admin/municipalities', icon: Building2 },
  { name: 'Usuários', href: '/admin/users', icon: Users },
];

function AdminSidebar({ pathname }: { pathname: string }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-destructive text-destructive-foreground">
          <ShieldAlert className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-none">GovMunicípio</p>
          <p className="text-xs text-muted-foreground">Administração</p>
        </div>
      </div>

      <Separator />

      <nav className="flex-1 space-y-1 px-3 py-4">
        {adminNav.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <Separator />

      <div className="px-4 py-4 space-y-2">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <LayoutDashboard className="h-3 w-3" />
          Voltar ao sistema
        </Link>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={() => logout()}
        >
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!isAuthenticated() || !isSuperAdmin()) {
      router.push('/dashboard');
      return;
    }
    setMounted(true);
  }, [router]);

  if (!mounted) return null;

  return (
    <div className="flex h-screen">
      <aside className="hidden w-64 shrink-0 border-r bg-card md:block">
        <AdminSidebar pathname={pathname} />
      </aside>
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
