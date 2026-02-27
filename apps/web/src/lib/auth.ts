import { apiClient } from './api';
import type { LoginResponseDto } from '@govmunicipio/shared';

export async function login(
  username: string,
  password: string,
  organizationId?: string,
): Promise<LoginResponseDto> {
  const data = await apiClient<LoginResponseDto>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password, organizationId }),
  });

  localStorage.setItem('token', data.accessToken);
  localStorage.setItem('principal', JSON.stringify(data.principal));

  return data;
}

export function logout(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('principal');
  window.location.href = '/auth/login';
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export function getCurrentPrincipal(): LoginResponseDto['principal'] | null {
  if (typeof window === 'undefined') return null;
  const data = localStorage.getItem('principal');
  return data ? JSON.parse(data) : null;
}

export function isAuthenticated(): boolean {
  const token = getToken();
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}
