import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest();
    const method = req?.method as string | undefined;

    const defaultMessageByMethod: Record<string, string> = {
      GET: 'Fetched successfully',
      POST: 'Created successfully',
      PATCH: 'Updated successfully',
      PUT: 'Updated successfully',
      DELETE: 'Deleted successfully',
    };

    return next.handle().pipe(
      map((data) => {
        if (
          data &&
          typeof data === 'object' &&
          'data' in data &&
          'message' in data
        ) {
          return data;
        }

        return {
          data,
          message: defaultMessageByMethod[method ?? ''] ?? 'Success',
        };
      }),
    );
  }
}

