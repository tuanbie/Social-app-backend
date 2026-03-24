import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const now = Date.now();
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    const method = req.method;
    const url = req.originalUrl || req.url;
    const ip = req.ip;

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - now;
          this.logger.log(`${method} ${url} ${res.statusCode} - ${ms}ms - ${ip}`);
        },
        error: () => {
          const ms = Date.now() - now;
          this.logger.error(`${method} ${url} ${res.statusCode} - ${ms}ms - ${ip}`);
        },
      }),
    );
  }
}

