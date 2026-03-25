import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserInput } from './dto/create-user.input';
import { UpdateUserInput } from './dto/update-user.input';
import { SurrealService } from 'src/database/surreal.service';
import { User, UserStatus } from './entities/user.entity';
import { StringRecordId, Table } from 'surrealdb';
import * as bcrypt from 'bcrypt';
import { PostStatus } from '../post/entities/post.entity';
import { UserProfileQueryDto } from './dto/user-profile-query.dto';
import { UserProfileResponseDto } from './dto/user-profile.response.dto';
import { UserBasicDto } from './dto/user-basic.dto';
import { UserFriendStatusDto, type FriendStatus } from './dto/user-friend-status.dto';
import { UserPostPreviewDto } from './dto/user-post-preview.dto';

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

  private asUserRid(userId: string): string {
    return userId.includes(':') ? userId : `user:${userId}`;
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

  async getUserProfile(
    viewerUserId: string,
    targetUserId: string,
    query: UserProfileQueryDto,
  ): Promise<UserProfileResponseDto> {
    const viewerRid = this.asUserRid(viewerUserId);
    const targetRid = this.asUserRid(targetUserId);

    const limit = Math.max(1, Number(query.limit ?? 10));
    const page = Math.max(1, Number(query.page ?? 1));

    const userRow = await this.surreal.client
      .select<any>(new StringRecordId(targetRid))
      .json();
    const user = this.unwrapOne<any>(userRow);
    if (!user) throw new NotFoundException('User not found');

    // normalize user basic info
    const basic: UserBasicDto = this.normalize(user) as any;
    if ('password' in user) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete (basic as any).password;
    }

    const postsRaw = await this.surreal.client.select<any>(new Table('post')).json();
    const postsFiltered = (postsRaw ?? [])
      .filter((p) => p?.status === PostStatus.published)
      .filter((p) => {
        const author = p?.author;
        const authorStr =
          typeof author === 'string'
            ? author
            : author?.toString
              ? author.toString()
              : null;
        return authorStr === targetRid;
      })
      .map((p) => this.normalize(p))
      .sort((a: any, b: any) => b.created_at.getTime() - a.created_at.getTime());

    const paged = postsFiltered.slice((page - 1) * limit, page * limit);
    const postPreviews: UserPostPreviewDto[] = paged.map((p: any) => ({
      id: p.id,
      content: p.content ?? null,
      image: p.image ?? null,
      files: p.files ?? [],
      author: p.author,
      status: p.status,
      created_at: p.created_at,
    }));

    // friend status between viewer and target
    const friendRows = await this.surreal.client.select<any>(new Table('friend')).json();
    const friend = (friendRows ?? []).find((f) => {
      const fin = f?.in;
      const fout = f?.out;
      return (fin === viewerRid && fout === targetRid) || (fin === targetRid && fout === viewerRid);
    });

    const status = (friend?.status ?? null) as FriendStatus | null;
    const friendResp: UserFriendStatusDto = {
      is_friend: status === 'accepted',
      status,
    };

    return {
      user: basic,
      posts: postPreviews,
      friend: friendResp,
    };
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
