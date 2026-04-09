import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SurrealService } from '../../database/surreal.service';
import { CreatePostInput } from './dto/create-post.input';
import { UpdatePostInput } from './dto/update-post.input';
import { Post, PostStatus } from './entities/post.entity';
import { StringRecordId, Table } from 'surrealdb';
import { PostQueryDto } from './dto/post-query.dto';
import type { PostAuthorDto } from './dto/post-author.dto';
import type { PostWithAuthorDto } from './dto/post-with-author.dto';

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
  constructor(private readonly surreal: SurrealService) { }

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
      author: this.normalizeAuthorRef(post.author),
      created_at:
        createdAt instanceof Date
          ? createdAt
          : createdAt
            ? new Date(createdAt)
            : new Date(),
    } as Post;
  }

  /** Chuẩn hóa record id user từ DB (string hoặc RecordId). */
  private normalizeAuthorRef(author: unknown): string {
    if (author == null) return '';
    if (typeof author === 'string') {
      return author.startsWith('user:') ? author : `user:${author}`;
    }
    const s = String(author);
    return s.includes('user:') ? s : `user:${s}`;
  }

  private normalizeUserRecordId(raw: string): string {
    const s = String(raw).trim();
    return s.startsWith('user:') ? s : `user:${s}`;
  }

  private normalizePostRef(ref: unknown): string {
    if (ref == null) return '';
    if (typeof ref === 'string') {
      return ref.startsWith('post:') ? ref : `post:${ref}`;
    }
    const s = String(ref);
    return s.includes('post:') ? s : `post:${s}`;
  }

  /** Khớp key với `getEngagementStatsForPostIds` / feed. */
  normalizePostRecordId(ref: unknown): string {
    return this.normalizePostRef(ref);
  }

  /** Bình luận gốc trên post: `parent` là NONE / null (không trỏ tới comment khác). */
  private isTopLevelComment(parent: unknown): boolean {
    if (parent == null || parent === undefined) return true;
    const str = String(parent).toLowerCase();
    if (str === 'none' || str === 'null') return true;
    if (str.includes('comment:')) return false;
    return true;
  }

  /** Một document / post: { post_id, liker_ids: [ user, ... ] } */
  private async fetchAllLikeDocuments(): Promise<
    { post_id?: unknown; liker_ids?: unknown[] }[]
  > {
    const collected = await this.surreal.client
      .query('SELECT * FROM like;')
      .collect<[unknown[]]>();
    const first = collected[0];
    return Array.isArray(first) ? (first as { post_id?: unknown; liker_ids?: unknown[] }[]) : [];
  }

  /** likes_count + comments_count (chỉ bình luận gốc) — dùng chung feed và profile user. */
  async getEngagementStatsForPostIds(postIds: string[]): Promise<{
    likes: Map<string, number>;
    comments: Map<string, number>;
  }> {
    return this.aggregateStatsForPosts(postIds);
  }

  private async aggregateStatsForPosts(postIds: string[]): Promise<{
    likes: Map<string, number>;
    comments: Map<string, number>;
  }> {
    const normIds = [...new Set(postIds.map((id) => this.normalizePostRef(id)))];
    const set = new Set(normIds);
    const likes = new Map<string, number>();
    const comments = new Map<string, number>();
    for (const id of normIds) {
      likes.set(id, 0);
      comments.set(id, 0);
    }

    const likeRows = await this.fetchAllLikeDocuments();
    for (const row of likeRows ?? []) {
      const postKey = this.normalizePostRef(row.post_id);
      if (set.has(postKey)) {
        const n = Array.isArray(row.liker_ids) ? row.liker_ids.length : 0;
        likes.set(postKey, n);
      }
    }

    const commentRows = await this.surreal.client.select<any>(new Table('comment')).json();
    for (const c of commentRows ?? []) {
      const postKey = this.normalizePostRef(c.post_id);
      if (!postKey.startsWith('post:') || !set.has(postKey)) continue;
      if (!this.isTopLevelComment(c.parent)) continue;
      comments.set(postKey, (comments.get(postKey) ?? 0) + 1);
    }

    return { likes, comments };
  }

  private async fetchUsersByIds(ids: string[]): Promise<Map<string, PostAuthorDto>> {
    const unique = [...new Set(ids.map((id) => this.normalizeUserRecordId(id)).filter(Boolean))];
    const map = new Map<string, PostAuthorDto>();
    await Promise.all(
      unique.map(async (id) => {
        try {
          const row = await this.surreal.client
            .select<any>(new StringRecordId(id))
            .json();
          const u = this.unwrapOne<any>(row);
          if (!u) return;
          const uid = this.normalizeAuthorRef(u.id ?? id);
          map.set(uid, {
            id: uid,
            full_name: u.full_name ?? null,
            username: u.username ?? null,
            avatar: u.avatar ?? null,
          });
        } catch {
          // bỏ qua user lỗi / không tồn tại
        }
      }),
    );
    return map;
  }

  private async mapPostsWithAuthors(posts: Post[]): Promise<PostWithAuthorDto[]> {
    const postIds = posts.map((p) => this.normalizePostRef(p.id));
    const { likes, comments } = await this.aggregateStatsForPosts(postIds);
    const authorIds = posts.map((p) => this.normalizeAuthorRef(p.author));
    const userMap = await this.fetchUsersByIds(authorIds);
    return posts.map((p) => {
      const pid = this.normalizePostRef(p.id);
      const aid = this.normalizeAuthorRef(p.author);
      const author: PostAuthorDto =
        userMap.get(aid) ?? {
          id: aid,
          full_name: null,
          username: null,
          avatar: null,
        };
      return {
        id: p.id,
        content: p.content ?? null,
        image: p.image ?? null,
        files: p.files ?? [],
        author,
        likes_count: likes.get(pid) ?? 0,
        comments_count: comments.get(pid) ?? 0,
        status: p.status,
        created_at: p.created_at,
      };
    });
  }

  private async findLikeDocumentByPostId(
    pid: string,
  ): Promise<{ id: string; liker_ids?: unknown[] } | null> {
    const [rows] = await this.surreal.client
      .query<[unknown[]]>(
        'SELECT * FROM like WHERE post_id = $post LIMIT 1;',
        { post: new StringRecordId(this.normalizePostRef(pid)) },
      )
      .collect<[unknown[]]>();
    const list = Array.isArray(rows) ? rows : [];
    const row = list[0] as Record<string, unknown> | undefined;
    if (!row?.id) return null;
    return {
      id: String(row.id),
      liker_ids: row.liker_ids as unknown[] | undefined,
    };
  }

  private likerIdListNormalized(likerIds: unknown[] | undefined): string[] {
    if (!Array.isArray(likerIds)) return [];
    return likerIds.map((x) => this.normalizeAuthorRef(x));
  }

  async likePost(userId: string, postId: string): Promise<{ liked: boolean }> {
    await this.loadPostById(postId);
    const uid = this.normalizeUserRecordId(userId);
    const pid = this.normalizePostRef(postId);
    const userRid = this.toRecordId('user', uid);
    const postRid = this.toRecordId('post', pid);

    const doc = await this.findLikeDocumentByPostId(pid);
    if (!doc) {
      await this.surreal.client
        .create<any>(new Table('like'))
        .content({
          post_id: postRid,
          liker_ids: [userRid],
        })
        .json();
      return { liked: true };
    }

    const ids = this.likerIdListNormalized(doc.liker_ids);
    if (ids.includes(uid)) {
      return { liked: true };
    }

    const next = [...(doc.liker_ids ?? []), userRid];
    await this.surreal.client
      .update<any>(new StringRecordId(doc.id))
      .merge({
        liker_ids: next,
        updated_at: new Date(),
      })
      .json();
    return { liked: true };
  }

  async unlikePost(userId: string, postId: string): Promise<{ liked: boolean }> {
    await this.loadPostById(postId);
    const uid = this.normalizeUserRecordId(userId);
    const pid = this.normalizePostRef(postId);

    const doc = await this.findLikeDocumentByPostId(pid);
    if (!doc?.liker_ids?.length) {
      return { liked: false };
    }

    const ids = this.likerIdListNormalized(doc.liker_ids);
    if (!ids.includes(uid)) {
      return { liked: false };
    }

    const next = (doc.liker_ids as unknown[]).filter(
      (x) => this.normalizeAuthorRef(x) !== uid,
    );
    await this.surreal.client
      .update<any>(new StringRecordId(doc.id))
      .merge({
        liker_ids: next,
        updated_at: new Date(),
      })
      .json();
    return { liked: false };
  }

  /** `status === true` → like, `false` → bỏ like */
  async setLikePost(
    userId: string,
    postId: string,
    status: boolean,
  ): Promise<{ liked: boolean }> {
    if (status) {
      return this.likePost(userId, postId);
    }
    return this.unlikePost(userId, postId);
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

  async create(createPostInput: CreatePostInput) {
    // SCHEMAFULL option<string>: không gửi `null` (Surreal báo lỗi NULL vs none|string).
    const payload: Record<string, unknown> = {
      files: createPostInput.files ?? [],
      author: this.toRecordId('user', createPostInput.authorId),
      status: createPostInput.status ?? PostStatus.published,
    };
    if (createPostInput.content != null) {
      payload.content = createPostInput.content;
    }
    if (createPostInput.image != null) {
      payload.image = createPostInput.image;
    }

    const created = await this.surreal.client
      .create<any>(new Table('post'))
      .content(payload)
      .json();
    const post = this.normalize(this.unwrapOne<Post>(created));
    const [withAuthor] = await this.mapPostsWithAuthors([post]);
    return withAuthor;
  }

  async findAll(query: PostQueryDto = {}): Promise<Post[]> {
    const rows = await this.surreal.client
      .select<Post>(new Table('post'))
      .json();
    const normalized = (rows ?? []).map((p) => this.normalize(p));

    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 10)));
    const authorId = query.author?.trim();
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

  async findFeedForUser(
    userId: string,
    query: PostQueryDto = {},
  ): Promise<{ items: PostWithAuthorDto[]; hasMore: boolean }> {
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 10)));
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

    const hasMore = queue.length > limit;
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

    const items = await this.mapPostsWithAuthors(result);
    return { items, hasMore };
  }

  private async loadPostById(id: string): Promise<Post> {
    const row = await this.surreal.client
      .select<Post>(new StringRecordId(id))
      .json();
    const post = this.unwrapOne<Post | undefined>(row);
    if (!post) throw new NotFoundException(`Post not found: ${id}`);
    return this.normalize(post);
  }

  /** Dùng cho GraphQL / nội bộ — `author` là record id string. */
  async findOne(id: string): Promise<Post> {
    return this.loadPostById(id);
  }

  /** REST: một bài kèm object author (id, tên, avatar). */
  async findOneWithAuthor(id: string): Promise<PostWithAuthorDto> {
    const post = await this.loadPostById(id);
    const [item] = await this.mapPostsWithAuthors([post]);
    return item;
  }

  private async assertPostOwner(postId: string, userId: string): Promise<Post> {
    const post = await this.loadPostById(postId);
    if (this.normalizeAuthorRef(post.author) !== this.normalizeUserRecordId(userId)) {
      throw new ForbiddenException('Only post owner can modify this post');
    }
    return post;
  }

  async update(id: string, updatePostInput: UpdatePostInput, currentUserId?: string): Promise<Post> {
    if (currentUserId) {
      await this.assertPostOwner(id, currentUserId);
    }
    const patch: Record<string, unknown> = {};
    if (updatePostInput.content !== undefined && updatePostInput.content !== null) {
      patch.content = updatePostInput.content;
    }
    if (updatePostInput.image !== undefined && updatePostInput.image !== null) {
      patch.image = updatePostInput.image;
    }
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
