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
import { UserBasicDto } from './dto/user-basic.dto';
import { SurrealService } from '../../database/surreal.service';
import { PostService } from '../post/post.service';

@Injectable()
export class UserService {
  constructor(
    private readonly surreal: SurrealService,
    private readonly postService: PostService,
  ) { }

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

  /** Chuẩn hóa `in` / `out` trên cạnh relation (string hoặc RecordId). */
  private edgeRid(v: unknown): string {
    if (v == null) return '';
    const s = typeof v === 'string' ? v : String(v);
    return this.asUserRid(s);
  }

  private async allBlocks(): Promise<any[]> {
    return (await this.surreal.client.select<any>(new Table('block')).json()) ?? [];
  }

  /** Block một chiều: `blocker` chặn `blocked`. */
  private findDirectedBlock(
    blocker: string,
    blocked: string,
    rows: any[],
  ): Record<string, unknown> | undefined {
    const b = this.asUserRid(blocker);
    const t = this.asUserRid(blocked);
    return (rows ?? []).find((r) => this.edgeRid(r?.in) === b && this.edgeRid(r?.out) === t);
  }

  private hasBlockBetween(a: string, b: string, rows: any[]): boolean {
    return (
      !!this.findDirectedBlock(a, b, rows) || !!this.findDirectedBlock(b, a, rows)
    );
  }

  private previewFallback(rid: string) {
    const id = this.asUserRid(rid);
    return { id, full_name: null, username: null, avatar: null };
  }

  /** Load id, full_name, username, avatar cho nhiều user (batch). */
  private async fetchUserPreviewMap(ids: string[]) {
    const unique = [...new Set(ids.map((x) => this.asUserRid(x)).filter(Boolean))];
    const map = new Map<string, any>();
    await Promise.all(
      unique.map(async (id) => {
        try {
          const row = await this.surreal.client.select<any>(new StringRecordId(id)).json();
          const u = this.unwrapOne<any>(row);
          if (!u) return;
          const uid = this.asUserRid(String(u.id ?? id));
          map.set(uid, {
            id: uid,
            full_name: u.full_name ?? null,
            username: u.username ?? null,
            avatar: u.avatar ?? null,
          });
        } catch {
          // user không tồn tại / lỗi
        }
      }),
    );
    return map;
  }

  private async mapFriendEdgesWithUsers(rows: any[]) {
    const ids: string[] = [];
    for (const r of rows) {
      ids.push(this.edgeRid(r?.in), this.edgeRid(r?.out));
    }
    const umap = await this.fetchUserPreviewMap(ids);
    return rows.map((r) => {
      const i = this.edgeRid(r?.in);
      const o = this.edgeRid(r?.out);
      const ca = r?.created_at;
      const ua = r?.updated_at;
      return {
        id: String(r?.id ?? ''),
        status: r?.status,
        created_at:
          ca instanceof Date ? ca : ca != null ? new Date(ca as string | number) : undefined,
        updated_at:
          ua instanceof Date ? ua : ua != null ? new Date(ua as string | number) : undefined,
        in_user: umap.get(i) ?? this.previewFallback(i),
        out_user: umap.get(o) ?? this.previewFallback(o),
      };
    });
  }

  private async mapBlockEdgesWithUsers(rows: any[]) {
    const ids: string[] = [];
    for (const r of rows) {
      ids.push(this.edgeRid(r?.in), this.edgeRid(r?.out));
    }
    const umap = await this.fetchUserPreviewMap(ids);
    return rows.map((r) => {
      const i = this.edgeRid(r?.in);
      const o = this.edgeRid(r?.out);
      return {
        id: String(r?.id ?? ''),
        in_user: umap.get(i) ?? this.previewFallback(i),
        out_user: umap.get(o) ?? this.previewFallback(o),
      };
    });
  }

  async create(createUserInput: CreateUserInput) {
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

  async findAll() {
    const rows = await this.surreal.client.select<User>(new Table('user')).json();
    return (rows ?? []).map((p) => this.normalize(p));
  }

  async getUserProfile(
    viewerUserId: string,
    targetUserId: string,
    query: UserProfileQueryDto,
  ) {
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
    const postIds = paged.map((p: any) => p.id);
    const { likes, comments } = await this.postService.getEngagementStatsForPostIds(postIds);

    const postPreviews: any[] = paged.map((p: any) => {
      const pid = this.postService.normalizePostRecordId(p.id);
      return {
        id: p.id,
        content: p.content ?? null,
        image: p.image ?? null,
        files: p.files ?? [],
        author: p.author,
        status: p.status,
        created_at: p.created_at,
        likes_count: likes.get(pid) ?? 0,
        comments_count: comments.get(pid) ?? 0,
      };
    });

    const blockRows = await this.allBlocks();
    const friend = await this.findFriendEdge(viewerRid, targetRid);
    const status = (friend?.status ?? null) as any | null;

    const friendResp: any = {
      is_friend: status === 'accepted',
      status:
        status && ['pending', 'accepted', 'declined'].includes(status) ? status : null,
      blocked_by_me: !!this.findDirectedBlock(viewerRid, targetRid, blockRows),
      blocked_by_them: !!this.findDirectedBlock(targetRid, viewerRid, blockRows),
    };

    return {
      user: basic,
      posts: postPreviews,
      friend: friendResp,
    };
  }

  private async findFriendEdge(
    viewerRid: string,
    targetRid: string,
  ) {
    const friendRows = await this.surreal.client.select<any>(new Table('friend')).json();
    const v = this.asUserRid(viewerRid);
    const t = this.asUserRid(targetRid);
    return (friendRows ?? []).find((f) => {
      const fin = this.edgeRid(f?.in);
      const fout = this.edgeRid(f?.out);
      return (fin === v && fout === t) || (fin === t && fout === v);
    });
  }

  async sendFriendRequest(viewerId: string, targetId: string) {
    const viewerRid = this.asUserRid(viewerId);
    const targetRid = this.asUserRid(targetId);
    if (viewerRid === targetRid) {
      throw new BadRequestException('Cannot friend yourself');
    }

    const blockRows = await this.allBlocks();
    if (this.hasBlockBetween(viewerRid, targetRid, blockRows)) {
      throw new BadRequestException('Cannot send friend request while a block exists');
    }

    const existing = await this.findFriendEdge(viewerRid, targetRid);
    if (existing) {
      const st = String(existing.status ?? '');
      if (st === 'accepted') {
        return existing;
      }
      if (st === 'pending') {
        const ein = this.edgeRid(existing.in);
        const eout = this.edgeRid(existing.out);
        // Họ đã gửi lời mời tới mình: in=target, out=viewer → chấp nhận
        if (ein === targetRid && eout === viewerRid) {
          const updated = await this.surreal.client
            .update(new StringRecordId(String(existing.id)))
            .merge({ status: 'accepted' })
            .json();
          return this.unwrapOne(updated);
        }
        return existing;
      }
      if (st === 'declined') {
        const updated = await this.surreal.client
          .update(new StringRecordId(String(existing.id)))
          .merge({ status: 'pending' })
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
    if (!existing?.id) {
      throw new NotFoundException('Friend relation not found');
    }
    await this.surreal.client.delete(new StringRecordId(String(existing.id))).json();
    return { success: true };
  }

  /** Lời mời đang chờ do **chính user gửi** (`in` = viewer, `out` = đối phương). */
  async listPendingFriends(viewerId: string) {
    const viewerRid = this.asUserRid(viewerId);
    const friendRows = await this.surreal.client.select<any>(new Table('friend')).json();
    const filtered = (friendRows ?? []).filter(
      (f) =>
        f?.status === 'pending' && this.edgeRid(f?.in) === viewerRid,
    );
    return this.mapFriendEdgesWithUsers(filtered);
  }

  async listFriends(viewerId: string) {
    const viewerRid = this.asUserRid(viewerId);
    const friendRows = await this.surreal.client.select<any>(new Table('friend')).json();
    const accepted = (friendRows ?? []).filter((f) => f?.status === 'accepted');
    const filtered = accepted.filter(
      (f) => this.edgeRid(f?.in) === viewerRid || this.edgeRid(f?.out) === viewerRid,
    );
    return this.mapFriendEdgesWithUsers(filtered);
  }

  /**
   * Chặn user (bảng `block`: in = viewer → out = target).
   * Xóa cạnh `friend` giữa hai người nếu có.
   */
  async blockUser(viewerId: string, targetId: string) {
    const viewerRid = this.asUserRid(viewerId);
    const targetRid = this.asUserRid(targetId);
    if (viewerRid === targetRid) {
      throw new BadRequestException('Cannot block yourself');
    }

    const blockRows = await this.allBlocks();
    const existingBlock = this.findDirectedBlock(viewerRid, targetRid, blockRows);
    if (existingBlock) {
      return existingBlock;
    }

    const fr = await this.findFriendEdge(viewerRid, targetRid);
    if (fr?.id) {
      await this.surreal.client.delete(new StringRecordId(String(fr.id))).json();
    }

    const created = await this.surreal.client
      .relate(
        new StringRecordId(viewerRid),
        new Table('block'),
        new StringRecordId(targetRid),
        {},
      )
      .json();
    return this.unwrapOne(created);
  }

  /** Danh sách user mà viewer đã chặn (`in` = viewer). */
  async listBlocked(viewerId: string) {
    const viewerRid = this.asUserRid(viewerId);
    const blockRows = await this.allBlocks();
    const filtered = blockRows.filter((b) => this.edgeRid(b?.in) === viewerRid);
    return this.mapBlockEdgesWithUsers(filtered);
  }

  /** Bỏ chặn: chỉ xóa cạnh viewer → target (không xóa chiều ngược). */
  async unblockUser(viewerId: string, targetId: string) {
    const viewerRid = this.asUserRid(viewerId);
    const targetRid = this.asUserRid(targetId);
    const blockRows = await this.allBlocks();
    const existing = this.findDirectedBlock(viewerRid, targetRid, blockRows);
    if (!existing?.id) {
      throw new NotFoundException('Block relation not found');
    }
    await this.surreal.client.delete(new StringRecordId(String(existing.id))).json();
    return { success: true };
  }

  async findOne(id: string) {
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
  ) {
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

  async remove(id: string, currentUserId?: string) {
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
