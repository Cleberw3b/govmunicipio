'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from './empty-state';
import { TableSkeleton } from './table-skeleton';

export interface ColumnDef<T> {
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  loading?: boolean;
  emptyMessage: string;
  emptyIcon?: LucideIcon;
  onEmptyAction?: () => void;
  emptyActionLabel?: string;
}

export function DataTable<T>({
  data,
  columns,
  loading = false,
  emptyMessage,
  emptyIcon,
  onEmptyAction,
  emptyActionLabel,
}: DataTableProps<T>) {
  if (loading) {
    return <TableSkeleton columns={columns.length} rows={5} />;
  }

  if (data.length === 0) {
    const Icon = emptyIcon;
    return (
      <EmptyState
        icon={Icon || (() => null)}
        title={emptyMessage}
        action={
          onEmptyAction && emptyActionLabel
            ? { label: emptyActionLabel, onClick: onEmptyAction }
            : undefined
        }
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((column, index) => (
            <TableHead key={`${column.header}-${index}`}>
              {column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row, rowIndex) => (
          <TableRow key={rowIndex}>
            {columns.map((column, colIndex) => {
              const cellValue =
                typeof column.accessor === 'function'
                  ? column.accessor(row)
                  : row[column.accessor];

              return (
                <TableCell key={`${rowIndex}-${colIndex}`} className={column.className}>
                  {cellValue as React.ReactNode}
                </TableCell>
              );
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
