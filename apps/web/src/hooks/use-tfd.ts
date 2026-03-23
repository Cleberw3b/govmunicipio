'use client';

import { useState, useEffect, useCallback } from 'react';
import { ITfdRequest, TfdStatus } from '@govmunicipio/shared';
import { apiClient } from '@/lib/api';

interface TfdRequestListItem {
  id: string;
  protocolNumber: string;
  requestDate: string | null;
  createdAt: string;
  status: { id: string; code: string; name: string };
  patientPerson?: { id: string; firstName: string; lastName: string };
  requestingDoctor?: {
    id: string;
    crm: string;
    person?: { firstName: string; lastName: string };
  };
  destinationHospital?: {
    id: string;
    cnesCode: string;
    organization?: { name: string };
  };
}

interface TfdStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  completed: number;
  scheduled: number;
  cancelled: number;
  [key: string]: number;
}

interface UseTfdRequestsResult {
  data: TfdRequestListItem[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  mutate: (data: TfdRequestListItem[]) => void;
}

interface UseTfdRequestResult {
  data: ITfdRequest | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  mutate: (data: ITfdRequest) => void;
}

interface UseTfdStatsResult {
  data: TfdStats | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch TFD requests, optionally filtered by status
 */
export function useTfdRequests(status?: string): UseTfdRequestsResult {
  const [data, setData] = useState<TfdRequestListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = status && status !== 'all' ? `?status=${status}` : '';
      const result = await apiClient<TfdRequestListItem[]>(
        `/tfd/requests${query}`,
      );
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('Failed to fetch TFD requests'),
      );
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  const mutate = useCallback((newData: TfdRequestListItem[]) => {
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
 * Hook to fetch a single TFD request by ID
 */
export function useTfdRequest(id: string): UseTfdRequestResult {
  const [data, setData] = useState<ITfdRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await apiClient<ITfdRequest>(`/tfd/requests/${id}`);
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('Failed to fetch TFD request'),
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  const mutate = useCallback((newData: ITfdRequest) => {
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
 * Hook to fetch TFD statistics
 */
export function useTfdStats(): UseTfdStatsResult {
  const [data, setData] = useState<TfdStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient<TfdStats>('/tfd/requests/stats');
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('Failed to fetch TFD stats'),
      );
      setData(null);
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

  return {
    data,
    loading,
    error,
    refetch,
  };
}
