'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';

interface UseApiOptions {
  enabled?: boolean;
}

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  mutate: (data: T) => void;
}

/**
 * Generic hook for fetching data from the API
 * Handles loading, error, and data states
 * Provides refetch and optimistic mutation capabilities
 */
export function useApi<T>(
  url: string,
  options: UseApiOptions = {},
): UseApiResult<T> {
  const { enabled = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await apiClient<T>(url);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [url, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  const mutate = useCallback((newData: T) => {
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
