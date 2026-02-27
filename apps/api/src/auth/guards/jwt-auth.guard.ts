import { Injectable, Logger, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  handleRequest<T>(err: unknown, user: T, info: unknown, context: ExecutionContext): T {
    const req = context.switchToHttp().getRequest<{ method: string; url: string }>();
    if (err || !user) {
      this.logger.warn(`Unauthorized ${req.method} ${req.url} — ${(info as Error)?.message ?? err}`);
    }
    return super.handleRequest(err, user, info, context);
  }
}
