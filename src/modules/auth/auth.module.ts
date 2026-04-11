import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginThrottleService } from './login-throttle.service';
import { TokenDenylistService } from './token-denylist.service';
import { appSettings } from '../../common/config/appSetting';

@Module({
  imports: [
    JwtModule.register({
      secret: appSettings.jwt.secret,
      signOptions: { expiresIn: (appSettings.jwt.expiresIn as any) || '1d' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LoginThrottleService,
    TokenDenylistService,
    JwtAuthGuard,
  ],
  exports: [
    AuthService,
    JwtAuthGuard,
    JwtModule,
    TokenDenylistService,
  ],
})
export class AuthModule {}

