import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateUserInput } from './dto/create-user.input';
import { UpdateUserInput } from './dto/update-user.input';
import { SurrealService } from 'src/database/surreal.service';
import { User, UserStatus } from './entities/user.entity';
import { Table } from 'surrealdb';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {

  constructor(private readonly surreal: SurrealService) {}

  private unwrapOne<T>(result: any): T {
    if (Array.isArray(result)) return result[0];
    return result as T;
  }

  private normalize(user: any): User {
    if (!user) return user as User;
    const createdAt = user.created_at;
    return {
      ...user,
      created_at:
        createdAt instanceof Date
          ? createdAt
          : createdAt
            ? new Date(createdAt)
            : new Date(),
    } as User;
  }

  private async allUsers(): Promise<any[]> {
    return (await this.surreal.client.select<any>(new Table('user')).json()) ?? [];
  }

  async create(createUserInput: CreateUserInput): Promise<User> {
    const users = await this.allUsers();
    const existingByEmail = users.find((u) => u?.email === createUserInput.email);
    if (existingByEmail) {
      throw new BadRequestException('Email already registered');
    }

    const existingByUsername = users.find((u) => u?.username === createUserInput.username);
    if (existingByUsername) {
      throw new BadRequestException('Username already exists');
    }

    const hashedPassword = await bcrypt.hash(createUserInput.password, 10);
    const created = await this.surreal.client
      .create<any>(new Table('user'))
      .content({
        username: createUserInput.username,
        full_name: createUserInput.full_name,
        email: createUserInput.email,
        password: hashedPassword,
        avatar: createUserInput.avatar ?? null,
        bio: createUserInput.bio ?? null,
        status: createUserInput.status ?? UserStatus.ACTIVE,
      })
      .json();

    const user = this.unwrapOne<any>(created);
    if (user && 'password' in user) {
      delete user.password;
    }
    return this.normalize(user);
  }

  async findAll(): Promise<User[]> {
    const rows = await this.surreal.client.select<User>(new Table('user')).json();
    return (rows ?? []).map((p) => this.normalize(p));
  }

  findOne(id: number) {
    return `This action returns a #${id} user`;
  }

  update(id: number, updateUserInput: UpdateUserInput) {
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}
