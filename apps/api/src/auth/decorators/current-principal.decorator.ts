import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentPrincipalData {
  principalId: string;
  organizationId: string;
  roles: string[];
  permissions: string[];
}

export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentPrincipalData => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ user: CurrentPrincipalData }>();
    return {
      principalId: request.user.principalId,
      organizationId: request.user.organizationId,
      roles: request.user.roles,
      permissions: request.user.permissions,
    };
  },
);
