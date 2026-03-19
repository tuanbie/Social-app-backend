import { Injectable } from '@nestjs/common';
import { CreateUserInput } from './dto/create-user.input';
import { UpdateUserInput } from './dto/update-user.input';
import { SurrealService } from 'src/database/surreal.service';
import { User } from './entities/user.entity';
import { Table } from 'surrealdb';

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

  create(createUserInput: CreateUserInput) {
    return `This action returns all user`;
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
