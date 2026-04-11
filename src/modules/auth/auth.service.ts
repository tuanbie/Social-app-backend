import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { SurrealService } from 'src/database/surreal.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { Table } from 'surrealdb';
import { LoginThrottleService } from './login-throttle.service';
import { TokenDenylistService } from './token-denylist.service';
import type { JwtUserPayload } from './types/jwt-user-payload.type';

@Injectable()
export class AuthService {
  constructor(
    private readonly surreal: SurrealService,
    private readonly jwtService: JwtService,
    private readonly loginThrottle: LoginThrottleService,
    private readonly tokenDenylist: TokenDenylistService,
  ) {}

  private async allUsers(): Promise<any[]> {
    return (await this.surreal.client.select<any>(new Table('user')).json()) ?? [];
  }

  private async findUserByEmail(email: string): Promise<any | null> {
    const users = await this.allUsers();
    return users.find((u) => u?.email === email) ?? null;
  }

  private async findUserByUsername(username: string): Promise<any | null> {
    const users = await this.allUsers();
    return users.find((u) => u?.username === username) ?? null;
  }

  async register(dto: RegisterDto) {
    const existingEmail = await this.findUserByEmail(dto.email);
    if (existingEmail) {
      throw new BadRequestException('Email already registered');
    }
    const existingUsername = await this.findUserByUsername(dto.username);
    if (existingUsername) {
      throw new BadRequestException('Username already exists');
    }

    const hashed = await bcrypt.hash(dto.password, 10);

    const createdList = await this.surreal.client
      .create<any>(new Table('user'))
      .content({
        username: dto.username,
        full_name: dto.full_name,
        email: dto.email,
        password: hashed,
        status: 'ACTIVE',
      })
      .json();

    const user = Array.isArray(createdList) ? createdList[0] : createdList;
    const jti = randomUUID();
    const token = await this.jwtService.signAsync({
      sub: user.id,
      id: user.id,
      username: user.username,
      email: user.email,
      jti,
    });

    return {
      accessToken: token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        email: user.email,
        status: user.status,
      },
    };
  }

  async login(dto: LoginDto) {
    await this.loginThrottle.assertNotLockedAsync(dto.email);

    const user = await this.findUserByEmail(dto.email);
    if (!user) {
      await this.loginThrottle.recordFailedAttempt(dto.email);
      throw new UnauthorizedException('Invalid credentials');
    }

    const ok = await bcrypt.compare(dto.password, user.password);
    if (!ok) {
      await this.loginThrottle.recordFailedAttempt(dto.email);
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.loginThrottle.clearFailedAttempts(dto.email);

    const jti = randomUUID();
    const token = await this.jwtService.signAsync({
      sub: user.id,
      id: user.id,
      username: user.username,
      email: user.email,
      jti,
    });

    return {
      accessToken: token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        email: user.email,
        status: user.status,
      },
    };
  }

  /** Đưa jti vào denylist Redis đến khi token hết hạn (cần REDIS_ENABLED). */
  async logout(payload: JwtUserPayload): Promise<{ ok: boolean }> {
    if (payload.jti && payload.exp != null) {
      await this.tokenDenylist.revokeUntilExpiry(payload.jti, payload.exp);
    }
    return { ok: true };
  }
}

