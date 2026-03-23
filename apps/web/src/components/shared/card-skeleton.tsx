"use client"

import React from 'react';
import { Card } from '@/components/ui/card';

export function CardSkeleton() {
  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
        <div className="space-y-2">
          <div className="h-8 bg-muted rounded animate-pulse w-3/4" />
          <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
        </div>
      </div>
    </Card>
  );
}
