import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtUserPayload } from './types/jwt-user-payload.type';
import { appSettings } from '../../common/config/appSetting';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly jwt = new JwtService({
    secret: appSettings.jwt.secret,
  });

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader = req?.headers?.authorization as string | undefined;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Bearer token');
    }

    const token = authHeader.slice(7);
    try {
      const payload = await this.jwt.verifyAsync<JwtUserPayload>(token);
      req.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}

