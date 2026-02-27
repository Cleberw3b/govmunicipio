'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BedDouble, Building2, Hospital, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api';

interface Counts {
  municipalities: number;
  hospitals: number;
  hotels: number;
  users: number;
}

const CARDS = [
  {
    key: 'municipalities' as const,
    label: 'Municípios',
    href: '/admin/municipalities',
    icon: Building2,
    color: 'text-blue-600',
  },
  {
    key: 'hospitals' as const,
    label: 'Hospitais',
    href: '/admin/hospitals',
    icon: Hospital,
    color: 'text-red-600',
  },
  {
    key: 'hotels' as const,
    label: 'Hotéis',
    href: '/admin/hotels',
    icon: BedDouble,
    color: 'text-amber-600',
  },
  {
    key: 'users' as const,
    label: 'Usuários',
    href: '/admin/users',
    icon: Users,
    color: 'text-purple-600',
  },
];

export default function AdminPage() {
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    Promise.all([
      apiClient<{ id: string }[]>('/admin/municipalities'),
      apiClient<{ id: string }[]>('/admin/hospitals'),
      apiClient<{ id: string }[]>('/admin/hotels'),
      apiClient<{ id: string }[]>('/admin/users'),
    ])
      .then(([municipalities, hospitals, hotels, users]) => {
        setCounts({
          municipalities: municipalities.length,
          hospitals: hospitals.length,
          hotels: hotels.length,
          users: users.length,
        });
      })
      .catch(console.error);
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Painel de Administração</h1>
        <p className="mt-1 text-muted-foreground">Visão geral da plataforma</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CARDS.map(({ key, label, href, icon: Icon, color }) => (
          <Link key={key} href={href} className="group">
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {label}
                </CardTitle>
                <Icon className={`h-5 w-5 ${color}`} />
              </CardHeader>
              <CardContent>
                {counts === null ? (
                  <div className="h-8 w-16 animate-pulse rounded bg-muted" />
                ) : (
                  <p className="text-3xl font-bold">{counts[key]}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground group-hover:underline">
                  Ver todos →
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
