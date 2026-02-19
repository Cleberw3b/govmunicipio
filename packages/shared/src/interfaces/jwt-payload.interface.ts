export interface IJwtPayload {
  sub: string;
  organizationId: string;
  roles: string[];
  permissions: string[];
  iat?: number;
  exp?: number;
}
