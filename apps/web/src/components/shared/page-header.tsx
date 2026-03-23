import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: {
    label: string;
    icon?: LucideIcon;
    onClick: () => void;
  };
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  const Icon = action?.icon;

  return (
    <div className="mb-8 flex items-start justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="text-muted-foreground">{description}</p>
        )}
      </div>

      {action && (
        <Button onClick={action.onClick} className="shrink-0">
          {Icon && <Icon className="h-4 w-4" />}
          {action.label}
        </Button>
      )}
    </div>
  );
}
