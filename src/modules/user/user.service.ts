import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserInput } from './dto/create-user.input';
import { UpdateUserInput } from './dto/update-user.input';
import { User, UserStatus } from './entities/user.entity';
import { StringRecordId, Table } from 'surrealdb';
import * as bcrypt from 'bcrypt';
import { PostStatus } from '../post/entities/post.entity';
import { UserProfileQueryDto } from './dto/user-profile-query.dto';
import { UserProfileResponseDto } from './dto/user-profile.response.dto';
import { UserBasicDto } from './dto/user-basic.dto';
import { UserFriendStatusDto, type FriendStatus } from './dto/user-friend-status.dto';
import { UserPostPreviewDto } from './dto/user-post-preview.dto';
import { SurrealService } from '../../database/surreal.service';

@Injectable()
export class UserService {

  constructor(private readonly surreal: SurrealService) { }

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

  private rowIdString(row: { id?: unknown } | null | undefined): string {
    if (!row?.id) return '';
    const id = row.id;
    return typeof id === 'string' ? this.asUserRid(id) : this.asUserRid(String(id));
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

  private async findFriendEdge(viewerRid: string, targetRid: string) {
    const friendRows = await this.surreal.client.select<any>(new Table('friend')).json();
    return (friendRows ?? []).find((f) => {
      const fin = f?.in;
      const fout = f?.out;
      return (fin === viewerRid && fout === targetRid) || (fin === targetRid && fout === viewerRid);
    });
  }

  async sendFriendRequest(viewerId: string, targetId: string) {
    const viewerRid = this.asUserRid(viewerId);
    const targetRid = this.asUserRid(targetId);
    if (viewerRid === targetRid) {
      throw new BadRequestException('Cannot friend yourself');
    }

    const existing = await this.findFriendEdge(viewerRid, targetRid);
    if (existing) {
      if (existing.status === 'blocked') {
        throw new BadRequestException('This relation is blocked');
      }
      if (existing.status === 'accepted') {
        return existing;
      }
      // nếu target đã gửi lời mời cho viewer thì auto accept
      if (existing.out === viewerRid && existing.in === targetRid && existing.status === 'pending') {
        const updated = await this.surreal.client
          .update(new StringRecordId(existing.id))
          .merge({ status: 'accepted' })
          .json();
        return this.unwrapOne(updated);
      }
      return existing;
    }

    const created = await this.surreal.client
      .relate(
        new StringRecordId(viewerRid),
        new Table('friend'),
        new StringRecordId(targetRid),
        { status: 'pending' },
      )
      .json();
    return this.unwrapOne(created);
  }

  async cancelFriend(viewerId: string, targetId: string) {
    const viewerRid = this.asUserRid(viewerId);
    const targetRid = this.asUserRid(targetId);
    const existing = await this.findFriendEdge(viewerRid, targetRid);
    if (!existing) {
      throw new NotFoundException('Friend relation not found');
    }
    await this.surreal.client.delete(new StringRecordId(existing.id)).json();
    return { success: true };
  }

  async listPendingFriends(viewerId: string) {
    const viewerRid = this.asUserRid(viewerId);
    const friendRows = await this.surreal.client.select<any>(new Table('friend')).json();
    const pending = (friendRows ?? []).filter(
      (f) => f?.status === 'pending' && f?.out === viewerRid,
    );
    return pending;
  }

  async listFriends(viewerId: string) {
    const viewerRid = this.asUserRid(viewerId);
    const friendRows = await this.surreal.client.select<any>(new Table('friend')).json();
    const accepted = (friendRows ?? []).filter((f) => f?.status === 'accepted');
    return accepted.filter((f) => f?.in === viewerRid || f?.out === viewerRid);
  }

  async blockUser(viewerId: string, targetId: string) {
    const viewerRid = this.asUserRid(viewerId);
    const targetRid = this.asUserRid(targetId);
    if (viewerRid === targetRid) {
      throw new BadRequestException('Cannot block yourself');
    }

    const existing = await this.findFriendEdge(viewerRid, targetRid);
    if (existing) {
      const updated = await this.surreal.client
        .update(new StringRecordId(existing.id))
        .merge({ status: 'blocked' })
        .json();
      return this.unwrapOne(updated);
    }

    const created = await this.surreal.client
      .relate(
        new StringRecordId(viewerRid),
        new Table('friend'),
        new StringRecordId(targetRid),
        { status: 'blocked' },
      )
      .json();
    return this.unwrapOne(created);
  }

  async listBlocked(viewerId: string) {
    const viewerRid = this.asUserRid(viewerId);
    const friendRows = await this.surreal.client.select<any>(new Table('friend')).json();
    const blocked = (friendRows ?? []).filter(
      (f) => f?.status === 'blocked' && (f?.in === viewerRid || f?.out === viewerRid),
    );
    return blocked;
  }

  async unblockUser(viewerId: string, targetId: string) {
    const viewerRid = this.asUserRid(viewerId);
    const targetRid = this.asUserRid(targetId);
    const existing = await this.findFriendEdge(viewerRid, targetRid);
    if (!existing) {
      throw new NotFoundException('Block relation not found');
    }
    await this.surreal.client.delete(new StringRecordId(existing.id)).json();
    return { success: true };
  }

  async findOne(id: string): Promise<User> {
    const rid = this.asUserRid(id);
    const row = await this.surreal.client.select<any>(new StringRecordId(rid)).json();
    const user = this.unwrapOne<any | undefined>(row);
    if (!user) throw new NotFoundException('User not found');
    if (user && 'password' in user) {
      delete user.password;
    }
    return this.normalize(user);
  }

  async update(
    id: string,
    updateUserInput: UpdateUserInput,
    currentUserId?: string,
  ): Promise<User> {
    const rid = this.asUserRid(id);
    if (currentUserId && this.asUserRid(currentUserId) !== rid) {
      throw new ForbiddenException('You can only update your own profile');
    }
    if (
      updateUserInput.id != null &&
      String(updateUserInput.id).length > 0 &&
      this.asUserRid(String(updateUserInput.id)) !== rid
    ) {
      throw new BadRequestException('User id mismatch');
    }

    const existingRow = await this.surreal.client.select<any>(new StringRecordId(rid)).json();
    const existing = this.unwrapOne<any | undefined>(existingRow);
    if (!existing) throw new NotFoundException('User not found');

    const selfRid = this.rowIdString(existing);
    const users = await this.allUsers();

    if (updateUserInput.email !== undefined && updateUserInput.email !== existing.email) {
      const taken = users.find((u) => u?.email === updateUserInput.email);
      if (taken && this.rowIdString(taken) !== selfRid) {
        throw new BadRequestException('Email already registered');
      }
    }
    if (updateUserInput.username !== undefined && updateUserInput.username !== existing.username) {
      const taken = users.find((u) => u?.username === updateUserInput.username);
      if (taken && this.rowIdString(taken) !== selfRid) {
        throw new BadRequestException('Username already exists');
      }
    }

    const patch: Record<string, unknown> = {};
    if (updateUserInput.username !== undefined) patch.username = updateUserInput.username;
    if (updateUserInput.full_name !== undefined) patch.full_name = updateUserInput.full_name;
    if (updateUserInput.email !== undefined) patch.email = updateUserInput.email;
    if (updateUserInput.avatar !== undefined) patch.avatar = updateUserInput.avatar;
    if (updateUserInput.bio !== undefined) patch.bio = updateUserInput.bio;
    if (updateUserInput.status !== undefined) patch.status = updateUserInput.status;
    if (updateUserInput.password !== undefined && updateUserInput.password.length > 0) {
      patch.password = await bcrypt.hash(updateUserInput.password, 10);
    }

    if (Object.keys(patch).length === 0) {
      const copy = { ...existing };
      if ('password' in copy) delete copy.password;
      return this.normalize(copy);
    }

    const merged = await this.surreal.client
      .update<any>(new StringRecordId(rid))
      .merge(patch)
      .json();
    const user = this.unwrapOne<any | undefined>(merged);
    if (!user) throw new NotFoundException('User not found');
    if ('password' in user) delete user.password;
    return this.normalize(user);
  }

  async remove(id: string, currentUserId?: string): Promise<User> {
    const rid = this.asUserRid(id);
    if (currentUserId && this.asUserRid(currentUserId) !== rid) {
      throw new ForbiddenException('You can only delete your own account');
    }
    await this.findOne(rid);
    const deleted = await this.surreal.client.delete<any>(new StringRecordId(rid)).json();
    const user = this.unwrapOne<any | undefined>(deleted);
    if (!user) throw new NotFoundException('User not found');
    if ('password' in user) delete user.password;
    return this.normalize(user);
  }
}
