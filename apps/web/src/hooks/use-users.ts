'use client';

import { useState, useEffect, useCallback } from 'react';
import { IPrincipal } from '@govmunicipio/shared';
import { apiClient } from '@/lib/api';

interface PrincipalListItem {
  id: string;
  username: string;
  isActive: boolean;
  person: { firstName: string; lastName: string; identification?: { cpf: string } } | null;
  roles: { name: string }[];
  organizations: { id: string; name: string }[];
}

interface UseUsersResult {
  data: PrincipalListItem[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  mutate: (data: PrincipalListItem[]) => void;
}

interface UseMunicipalityUsersResult {
  data: PrincipalListItem[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  mutate: (data: PrincipalListItem[]) => void;
}

/**
 * Hook to fetch all users (admin view)
 */
export function useUsers(): UseUsersResult {
  const [data, setData] = useState<PrincipalListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient<PrincipalListItem[]>('/admin/users');
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch users'));
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  const mutate = useCallback((newData: PrincipalListItem[]) => {
    setData(newData);
  }, []);

  return {
    data,
    loading,
    error,
    refetch,
    mutate,
  };
}

/**
 * Hook to fetch users for a specific municipality
 */
export function useMunicipalityUsers(municipalityId: string): UseMunicipalityUsersResult {
  const [data, setData] = useState<PrincipalListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!municipalityId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await apiClient<PrincipalListItem[]>(
        `/municipality/users?municipalityId=${municipalityId}`,
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch users'));
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [municipalityId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  const mutate = useCallback((newData: PrincipalListItem[]) => {
    setData(newData);
  }, []);

  return {
    data,
    loading,
    error,
    refetch,
    mutate,
  };
}
