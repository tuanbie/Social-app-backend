import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtUserPayload } from './types/jwt-user-payload.type';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUserPayload | undefined => {
    const req = ctx.switchToHttp().getRequest();
    return req?.user as JwtUserPayload | undefined;
  },
);

