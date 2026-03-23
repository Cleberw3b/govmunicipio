import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AccessibleIconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string;
  variant?: 'outline' | 'ghost' | 'default' | 'destructive' | 'secondary' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon' | 'xs' | 'icon-xs' | 'icon-sm' | 'icon-lg';
  children: React.ReactNode;
}

export function AccessibleIconButton({
  'aria-label': ariaLabel,
  variant = 'default',
  size = 'icon',
  className,
  children,
  ...props
}: AccessibleIconButtonProps) {
  return (
    <Button
      aria-label={ariaLabel}
      variant={variant}
      size={size}
      className={cn(className)}
      {...props}
    >
      {children}
    </Button>
  );
}
