'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  BedDouble,
  Building,
  Building2,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { isAuthenticated, getCurrentPrincipal, logout } from '@/lib/auth';
import { isAdminMunicipality, isSuperAdmin } from '@/lib/admin-auth';

function SidebarContent({ pathname }: { pathname: string }) {
  const principal = getCurrentPrincipal();
  const adminMunicipality = isAdminMunicipality();

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'TFD > Solicitações', href: '/tfd/requests', icon: FileText },
    ...(adminMunicipality
      ? [
          { name: 'Organizações', href: '/dashboard/organizations', icon: Building },
          { name: 'Hotéis', href: '/dashboard/hotels', icon: BedDouble },
          { name: 'Usuários', href: '/dashboard/users', icon: Users },
        ]
      : []),
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Building2 className="h-4 w-4" />
        </div>
        <span className="text-lg font-semibold">GovMunicípio</span>
      </div>

      <Separator />

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
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

      <div className="px-4 py-4">
        {principal && (
          <p className="mb-3 truncate text-sm text-muted-foreground">
            {principal.username}
          </p>
        )}
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

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/auth/login');
      return;
    }
    if (isSuperAdmin()) {
      router.push('/admin');
      return;
    }
    setMounted(true);
  }, [router]);

  if (!mounted) {
    return null;
  }

  return (
    <div className="flex h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r bg-card md:block">
        <SidebarContent pathname={pathname} />
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Mobile header */}
          <header className="flex h-14 items-center gap-2 border-b px-4 md:hidden">
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Abrir menu</span>
              </Button>
            </SheetTrigger>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              <span className="font-semibold">GovMunicípio</span>
            </div>
          </header>

          {/* Main content */}
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>

        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Menu de navegação</SheetTitle>
          </SheetHeader>
          <SidebarContent pathname={pathname} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
