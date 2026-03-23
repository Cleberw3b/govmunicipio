import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

interface RequestWithUser {
  method: string;
  originalUrl: string;
  user?: {
    sub: string;
  };
}

interface Response {
  statusCode: number;
}

interface StructuredLog {
  timestamp: string;
  requestId: string;
  method: string;
  url: string;
  statusCode: number;
  duration: number;
  userId?: string;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(
    context: ExecutionContext,
    next: any,
  ): Observable<any> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const response = context.switchToHttp().getResponse<Response>();

    const requestId = uuidv4();
    const startTime = Date.now();
    const method = request.method;
    const url = request.originalUrl;
    const userId = request.user?.sub;

    // Attach requestId to request for correlation
    (request as any).requestId = requestId;

    return next.handle().pipe(
      tap(
        () => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode;

          const logData: StructuredLog = {
            timestamp: new Date().toISOString(),
            requestId,
            method,
            url,
            statusCode,
            duration,
            ...(userId && { userId }),
          };

          // Log slow requests (>500ms) at WARN level
          if (duration > 500) {
            this.logger.warn(JSON.stringify(logData));
          } else {
            this.logger.log(JSON.stringify(logData));
          }
        },
        (error) => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode || 500;

          const logData: StructuredLog = {
            timestamp: new Date().toISOString(),
            requestId,
            method,
            url,
            statusCode,
            duration,
            ...(userId && { userId }),
          };

          this.logger.error(JSON.stringify(logData), error.stack);
        },
      ),
    );
  }
}
