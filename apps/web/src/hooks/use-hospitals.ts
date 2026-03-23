'use client';

import { useState, useEffect, useCallback } from 'react';
import { IHospital, IHospitalListItem } from '@govmunicipio/shared';
import { apiClient } from '@/lib/api';

interface UseHospitalsResult {
  data: IHospitalListItem[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  mutate: (data: IHospitalListItem[]) => void;
}

interface UseHospitalResult {
  data: IHospital | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  mutate: (data: IHospital) => void;
}

interface UseLinkedHospitalsResult {
  data: IHospitalListItem[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch all hospitals (admin view)
 */
export function useHospitals(): UseHospitalsResult {
  const [data, setData] = useState<IHospitalListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient<IHospitalListItem[]>('/admin/hospitals');
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch hospitals'));
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

  const mutate = useCallback((newData: IHospitalListItem[]) => {
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
 * Hook to fetch a single hospital by ID
 */
export function useHospital(id: string): UseHospitalResult {
  const [data, setData] = useState<IHospital | null>(null);
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
      const result = await apiClient<IHospital>(`/admin/hospitals/${id}`);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch hospital'));
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

  const mutate = useCallback((newData: IHospital) => {
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
 * Hook to fetch hospitals linked to a municipality
 */
export function useLinkedHospitals(
  municipalityId: string,
): UseLinkedHospitalsResult {
  const [data, setData] = useState<IHospitalListItem[]>([]);
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
      const result = await apiClient<IHospitalListItem[]>(
        `/municipality/hospitals?municipalityId=${municipalityId}`,
      );
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('Failed to fetch hospitals'),
      );
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

  return {
    data,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook to fetch available hospitals (not yet linked to a municipality)
 */
export function useAvailableHospitals(
  municipalityId: string,
): UseLinkedHospitalsResult {
  const [data, setData] = useState<IHospitalListItem[]>([]);
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
      const result = await apiClient<IHospitalListItem[]>(
        `/municipality/hospitals/available?municipalityId=${municipalityId}`,
      );
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('Failed to fetch hospitals'),
      );
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

  return {
    data,
    loading,
    error,
    refetch,
  };
}
