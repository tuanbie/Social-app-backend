import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SurrealService } from '../../database/surreal.service';
import { CreatePostInput } from './dto/create-post.input';
import { UpdatePostInput } from './dto/update-post.input';
import { Post, PostStatus } from './entities/post.entity';
import { StringRecordId, Table } from 'surrealdb';
import { PostQueryDto } from './dto/post-query.dto';

type FriendRelation = {
  id: string;
  in: string;
  out: string;
  status?: string;
};

type SeenRecord = {
  id: string;
  in?: string;
  out?: string;
  user?: string;
  target?: string;
  user_id?: string;
  seen_post_ids?: string[];
};

@Injectable()
export class PostService {
  constructor(private readonly surreal: SurrealService) {}

  private toRecordId(table: 'user' | 'post' | 'seen', value: string): StringRecordId {
    const normalized = value.startsWith(`${table}:`) ? value : `${table}:${value}`;
    return new StringRecordId(normalized);
  }

  private unwrapOne<T>(result: any): T {
    if (Array.isArray(result)) return result[0];
    return result as T;
  }

  private normalize(post: any): Post {
    if (!post) return post as Post;
    const createdAt = post.created_at;
    return {
      ...post,
      created_at:
        createdAt instanceof Date
          ? createdAt
          : createdAt
            ? new Date(createdAt)
            : new Date(),
    } as Post;
  }

  private parseBrokenSeenId(message: string): string | null {
    const match = message.match(/`(seen:[^`]+)`/);
    return match?.[1] ?? null;
  }

  private toPostIdString(value: unknown): string | null {
    if (typeof value === 'string') return value;
    if (value && typeof (value as any).toString === 'function') {
      const s = (value as any).toString();
      return typeof s === 'string' ? s : null;
    }
    return null;
  }

  private async safeSelectSeen(): Promise<SeenRecord[]> {
    // Nếu DB có dữ liệu seen cũ sai format relation, xóa record lỗi rồi thử lại.
    for (let i = 0; i < 10; i++) {
      try {
        const rows = await this.surreal.client.select<SeenRecord>(new Table('seen')).json();
        return rows ?? [];
      } catch (err: any) {
        const msg = String(err?.message ?? err ?? '');
        const brokenId = this.parseBrokenSeenId(msg);
        const shouldCleanup =
          msg.includes('not a relation') || msg.includes("Couldn't coerce value for field");
        if (!brokenId || !shouldCleanup) throw err;
        await this.surreal.client.delete(new StringRecordId(brokenId)).json();
      }
    }
    return [];
  }

  async create(createPostInput: CreatePostInput): Promise<Post> {
    const payload = {
      content: createPostInput.content ?? null,
      image: createPostInput.image ?? null,
      files: createPostInput.files ?? [],
      author: this.toRecordId('user', createPostInput.authorId),
      status: createPostInput.status ?? PostStatus.published,
      // created_at để DB default time::now()
    };

    const created = await this.surreal.client
      .create<any>(new Table('post'))
      .content(payload)
      .json();
    return this.normalize(this.unwrapOne<Post>(created));
  }

  async findAll(query: PostQueryDto = {}): Promise<Post[]> {
    const rows = await this.surreal.client
      .select<Post>(new Table('post'))
      .json();
    const normalized = (rows ?? []).map((p) => this.normalize(p));

    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.max(1, Number(query.limit ?? 10));
    const authorId = query.authorId?.trim();
    const keyword = query.keyword?.trim().toLowerCase();

    const filtered = normalized.filter((p) => {
      if (authorId && p.author !== authorId) return false;
      if (query.status && p.status !== query.status) return false;
      if (keyword) {
        const content = (p.content ?? '').toLowerCase();
        if (!content.includes(keyword)) return false;
      }
      return true;
    });

    // newest first
    filtered.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

    const start = (page - 1) * limit;
    return filtered.slice(start, start + limit);
  }

  async findFeedForUser(userId: string, query: PostQueryDto = {}): Promise<Post[]> {
    const limit = Math.max(1, Number(query.limit ?? 10));
    const keyword = query.keyword?.trim().toLowerCase();
    const status = query.status;

    const allPostsRaw = await this.surreal.client.select<Post>(new Table('post')).json();
    const allPosts = (allPostsRaw ?? []).map((p) => this.normalize(p));

    const filteredByQuery = allPosts.filter((p) => {
      if (status && p.status !== status) return false;
      if (keyword) {
        const content = (p.content ?? '').toLowerCase();
        if (!content.includes(keyword)) return false;
      }
      return true;
    });
    filteredByQuery.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

    const friendsRaw = await this.surreal.client.select<FriendRelation>(new Table('friend')).json();
    const accepted = (friendsRaw ?? []).filter((f) => f?.status === 'accepted');
    const friendIds = new Set<string>();
    for (const rel of accepted) {
      if (rel.in === userId) friendIds.add(rel.out);
      if (rel.out === userId) friendIds.add(rel.in);
    }

    const seenRaw = await this.safeSelectSeen();
    const seenByUser = (seenRaw ?? []).filter((s) => (s.in ?? s.user_id ?? s.user) === userId);
    const seenPostIds = new Set(
      seenByUser.flatMap((s) => {
        const list: string[] = [];
        const edgeTarget = this.toPostIdString(s.out ?? s.target);
        if (edgeTarget?.startsWith('post:')) list.push(edgeTarget);
        for (const id of s.seen_post_ids ?? []) {
          const parsed = this.toPostIdString(id);
          if (parsed?.startsWith('post:')) list.push(parsed);
        }
        return list;
      }),
    );

    const prioritize = (source: Post[]) => {
      const unseen = source.filter((p) => !seenPostIds.has(p.id));
      const friendPosts = unseen.filter((p) => friendIds.has(p.author));
      const nonFriendPosts = unseen.filter((p) => !friendIds.has(p.author));
      return [...friendPosts, ...nonFriendPosts];
    };

    let queue = prioritize(filteredByQuery);

    // Đã xem hết -> reset lịch sử seen của user rồi lấy lại từ đầu
    if (queue.length === 0 && filteredByQuery.length > 0) {
      for (const seen of seenByUser) {
        await this.surreal.client.delete(new StringRecordId(seen.id)).json();
      }
      queue = [...filteredByQuery].sort((a, b) => {
        const aFriend = friendIds.has(a.author) ? 1 : 0;
        const bFriend = friendIds.has(b.author) ? 1 : 0;
        if (aFriend !== bFriend) return bFriend - aFriend;
        return b.created_at.getTime() - a.created_at.getTime();
      });
    }

    const result = queue.slice(0, limit);

    // Lưu lịch sử đã xem: nếu có record seen của user thì push thêm id, chưa có thì tạo mới.
    const resultPostIds = result.map((p) => p.id);
    if (resultPostIds.length > 0) {
      const primarySeen = seenByUser[0];
      if (primarySeen) {
        const mergedIds = Array.from(
          new Set([...(primarySeen.seen_post_ids ?? []), ...resultPostIds]),
        );
        const mergedRecordIds = mergedIds.map((id) => this.toRecordId('post', id));
        await this.surreal.client
          .update(new StringRecordId(primarySeen.id))
          .merge({
            user_id: this.toRecordId('user', userId),
            seen_post_ids: mergedRecordIds,
          })
          .json();
      } else {
        await this.surreal.client
          .relate(
            this.toRecordId('user', userId),
            new Table('seen'),
            this.toRecordId('post', resultPostIds[0]),
            {
              user_id: this.toRecordId('user', userId),
              seen_post_ids: resultPostIds.map((id) => this.toRecordId('post', id)),
            },
          )
          .json();
      }
    }

    return result;
  }

  async findOne(id: string): Promise<Post> {
    const row = await this.surreal.client
      .select<Post>(new StringRecordId(id))
      .json();
    const post = this.unwrapOne<Post | undefined>(row);
    if (!post) throw new NotFoundException(`Post not found: ${id}`);
    return this.normalize(post);
  }

  private async assertPostOwner(postId: string, userId: string): Promise<Post> {
    const post = await this.findOne(postId);
    if (post.author !== userId) {
      throw new ForbiddenException('Only post owner can modify this post');
    }
    return post;
  }

  async update(id: string, updatePostInput: UpdatePostInput, currentUserId?: string): Promise<Post> {
    if (currentUserId) {
      await this.assertPostOwner(id, currentUserId);
    }
    const patch: Record<string, unknown> = {};
    if (updatePostInput.content !== undefined) patch.content = updatePostInput.content;
    if (updatePostInput.image !== undefined) patch.image = updatePostInput.image;
    if (updatePostInput.files !== undefined) patch.files = updatePostInput.files;
    if (updatePostInput.status !== undefined) patch.status = updatePostInput.status;

    const merged = await this.surreal.client
      .update<Post>(new StringRecordId(id))
      .merge(patch)
      .json();
    const post = this.unwrapOne<Post | undefined>(merged);
    if (!post) throw new NotFoundException(`Post not found: ${id}`);
    return this.normalize(post);
  }

  async remove(id: string, currentUserId?: string): Promise<Post> {
    if (currentUserId) {
      await this.assertPostOwner(id, currentUserId);
    }
    const deleted = await this.surreal.client
      .delete<Post>(new StringRecordId(id))
      .json();
    const post = this.unwrapOne<Post | undefined>(deleted);
    if (!post) throw new NotFoundException(`Post not found: ${id}`);
    return this.normalize(post);
  }
}
