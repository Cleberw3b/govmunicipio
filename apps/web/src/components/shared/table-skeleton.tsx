"use client"

import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHead,
  TableRow,
} from '@/components/ui/table';

interface TableSkeletonProps {
  columns: number;
  rows?: number;
}

export function TableSkeleton({ columns, rows = 5 }: TableSkeletonProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {Array.from({ length: columns }).map((_, i) => (
            <TableHead key={`header-${i}`}>
              <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <TableRow key={`row-${rowIndex}`}>
            {Array.from({ length: columns }).map((_, colIndex) => (
              <TableCell key={`cell-${rowIndex}-${colIndex}`}>
                <div className="h-4 bg-muted rounded animate-pulse w-full" />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
