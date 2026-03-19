import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SurrealService } from 'src/database/surreal.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly surreal: SurrealService,
    private readonly jwtService: JwtService,
  ) {}

  private async findUserByEmail(email: string): Promise<any | null> {
    const [res] = await this.surreal.client
      .query<[any[]]>('SELECT * FROM user WHERE email = $email LIMIT 1', {
        email,
      })
      .json();
    return res?.[0] ?? null;
  }

  async register(dto: RegisterDto) {
    const existing = await this.findUserByEmail(dto.email);
    if (existing) {
      throw new BadRequestException('Email already registered');
    }

    const hashed = await bcrypt.hash(dto.password, 10);

    const [createdList] = await this.surreal.client
      .query<[any[]]>(
        `
        CREATE user CONTENT {
          username: $username,
          full_name: $full_name,
          email: $email,
          password: $password,
          status: 'ACTIVE'
        }
      `,
        {
          username: dto.username,
          full_name: dto.full_name,
          email: dto.email,
          password: hashed,
        },
      )
      .json();

    const user = createdList?.[0];
    const token = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
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
    const user = await this.findUserByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const ok = await bcrypt.compare(dto.password, user.password);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
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
}

