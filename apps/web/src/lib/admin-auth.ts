import { getCurrentPrincipal } from './auth';

export function isSuperAdmin(): boolean {
  const principal = getCurrentPrincipal();
  return Array.isArray(principal?.roles) && principal.roles.includes('super_admin');
}
