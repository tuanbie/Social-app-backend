import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SurrealService } from '../../database/surreal.service';
import { StringRecordId, Table } from 'surrealdb';
import type { PostAuthorDto } from './dto/post-author.dto';
import type { CommentWithAuthorDto } from './dto/comment-with-author.dto';
import type { CreateCommentDto } from './dto/create-comment.dto';
import type { CommentListQueryDto } from './dto/comment-list-query.dto';
import type { CommentListItemDto } from './dto/comment-list-item.dto';

type RawComment = {
  id: string;
  content: string;
  author: unknown;
  post_id?: unknown;
  parent?: unknown;
  created_at?: Date | string;
};

@Injectable()
export class CommentService {
  constructor(private readonly surreal: SurrealService) {}

  private unwrapOne<T>(result: unknown): T {
    if (Array.isArray(result)) return result[0] as T;
    return result as T;
  }

  private toRecordId(
    table: 'user' | 'post' | 'comment',
    value: string,
  ): StringRecordId {
    const normalized = value.startsWith(`${table}:`) ? value : `${table}:${value}`;
    return new StringRecordId(normalized);
  }

  private normalizeAuthorRef(author: unknown): string {
    if (author == null) return '';
    if (typeof author === 'string') {
      return author.startsWith('user:') ? author : `user:${author}`;
    }
    const s = String(author);
    return s.includes('user:') ? s : `user:${s}`;
  }

  private normalizePostRef(ref: unknown): string {
    if (ref == null) return '';
    if (typeof ref === 'string') {
      return ref.startsWith('post:') ? ref : `post:${ref}`;
    }
    const s = String(ref);
    return s.includes('post:') ? s : `post:${s}`;
  }

  private normalizeCommentRef(ref: unknown): string {
    if (ref == null) return '';
    if (typeof ref === 'string') {
      return ref.startsWith('comment:') ? ref : `comment:${ref}`;
    }
    const s = String(ref);
    return s.includes('comment:') ? s : `comment:${s}`;
  }

  /** Bình luận gốc trên post (parent NONE / null). */
  private isTopLevelParent(parent: unknown): boolean {
    if (parent == null || parent === undefined) return true;
    const str = String(parent).toLowerCase();
    if (str === 'none' || str === 'null') return true;
    if (str.includes('comment:')) return false;
    return true;
  }

  /** API: null = bình luận gốc; string = reply */
  private parentToApi(parent: unknown): string | null {
    if (parent == null || parent === undefined) return null;
    const str = String(parent).toLowerCase();
    if (str === 'none' || str === 'null') return null;
    const cid = this.normalizeCommentRef(parent);
    return cid.startsWith('comment:') ? cid : null;
  }

  private async fetchUsersByIds(ids: string[]): Promise<Map<string, PostAuthorDto>> {
    const norm = (raw: string) =>
      raw.startsWith('user:') ? raw : `user:${raw}`;
    const unique = [...new Set(ids.map(norm).filter(Boolean))];
    const map = new Map<string, PostAuthorDto>();
    await Promise.all(
      unique.map(async (id) => {
        try {
          const row = await this.surreal.client
            .select<unknown>(new StringRecordId(id))
            .json();
          const u = this.unwrapOne<Record<string, unknown>>(row);
          if (!u || typeof u !== 'object') return;
          const uid = this.normalizeAuthorRef(u.id ?? id);
          map.set(uid, {
            id: uid,
            full_name: (u.full_name as string) ?? null,
            username: (u.username as string) ?? null,
            avatar: (u.avatar as string) ?? null,
          });
        } catch {
          /* skip */
        }
      }),
    );
    return map;
  }

  private normalizeComment(raw: RawComment): RawComment {
    const createdAt = raw.created_at;
    return {
      ...raw,
      created_at:
        createdAt instanceof Date
          ? createdAt
          : createdAt
            ? new Date(createdAt as string)
            : new Date(),
    };
  }

  private async mapCommentsWithAuthors(
    rows: RawComment[],
  ): Promise<CommentWithAuthorDto[]> {
    const authorIds = rows.map((r) => this.normalizeAuthorRef(r.author));
    const userMap = await this.fetchUsersByIds(authorIds);
    return rows.map((r) => {
      const aid = this.normalizeAuthorRef(r.author);
      const author: PostAuthorDto =
        userMap.get(aid) ?? {
          id: aid,
          full_name: null,
          username: null,
          avatar: null,
        };
      const normalized = this.normalizeComment(r);
      return {
        id: normalized.id,
        content: normalized.content,
        post_id: this.normalizePostRef(normalized.post_id),
        parent: this.parentToApi(normalized.parent),
        author,
        created_at: normalized.created_at as Date,
      };
    });
  }

  private async fetchCommentsByPostId(postId: string): Promise<RawComment[]> {
    const pid = this.normalizePostRef(postId);
    const [rows] = await this.surreal.client
      .query<[unknown[]]>(
        'SELECT * FROM comment WHERE post_id = $post;',
        { post: new StringRecordId(pid) },
      )
      .collect<[unknown[]]>();
    const list = Array.isArray(rows) ? rows : [];
    return list.map((r) =>
      this.normalizeComment({ ...(r as RawComment), id: String((r as RawComment).id) }),
    );
  }

  private countDirectRepliesForParents(
    allRows: RawComment[],
    parentIds: Set<string>,
  ): Map<string, number> {
    const map = new Map<string, number>();
    for (const id of parentIds) map.set(id, 0);
    for (const row of allRows) {
      const p = this.normalizeCommentRef(row.parent);
      if (!p.startsWith('comment:')) continue;
      if (parentIds.has(p)) {
        map.set(p, (map.get(p) ?? 0) + 1);
      }
    }
    return map;
  }

  private toCommentListItems(
    rows: RawComment[],
    replyCounts: Map<string, number>,
    dtos: CommentWithAuthorDto[],
  ): CommentListItemDto[] {
    return dtos.map((m) => ({
      ...m,
      replies_count: replyCounts.get(m.id) ?? 0,
    }));
  }

  async listCommentsForPost(
    postId: string,
    query: CommentListQueryDto,
  ): Promise<{ items: CommentListItemDto[]; hasMore: boolean }> {
    await this.assertPostExists(postId);
    const pid = this.normalizePostRef(postId);
    const all = await this.fetchCommentsByPostId(pid);
    const topLevel = all
      .filter((r) => this.isTopLevelParent(r.parent))
      .sort(
        (a, b) =>
          new Date(b.created_at as string).getTime() -
          new Date(a.created_at as string).getTime(),
      );

    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));
    const start = (page - 1) * limit;
    const slice = topLevel.slice(start, start + limit);
    const hasMore = topLevel.length > start + limit;

    const pageIds = new Set(slice.map((r) => this.normalizeCommentRef(r.id)));
    const replyCounts = this.countDirectRepliesForParents(all, pageIds);
    const mapped = await this.mapCommentsWithAuthors(slice);
    return {
      items: this.toCommentListItems(slice, replyCounts, mapped),
      hasMore,
    };
  }

  async listRepliesForComment(
    commentId: string,
    query: CommentListQueryDto,
  ): Promise<{ items: CommentListItemDto[]; hasMore: boolean }> {
    const parent = await this.loadCommentRaw(commentId);
    const postIdStr = this.normalizePostRef(parent.post_id);
    const cid = this.normalizeCommentRef(commentId);

    const all = await this.fetchCommentsByPostId(postIdStr);
    const direct = all
      .filter((r) => this.normalizeCommentRef(r.parent) === cid)
      .sort(
        (a, b) =>
          new Date(b.created_at as string).getTime() -
          new Date(a.created_at as string).getTime(),
      );

    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));
    const start = (page - 1) * limit;
    const slice = direct.slice(start, start + limit);
    const hasMore = direct.length > start + limit;

    const pageIds = new Set(slice.map((r) => this.normalizeCommentRef(r.id)));
    const replyCounts = this.countDirectRepliesForParents(all, pageIds);
    const mapped = await this.mapCommentsWithAuthors(slice);
    return {
      items: this.toCommentListItems(slice, replyCounts, mapped),
      hasMore,
    };
  }

  private async assertPostExists(postId: string): Promise<void> {
    const row = await this.surreal.client
      .select<unknown>(new StringRecordId(postId))
      .json();
    const one = this.unwrapOne<Record<string, unknown> | undefined>(row);
    if (!one) {
      throw new NotFoundException(`Post not found: ${postId}`);
    }
  }

  private async loadCommentRaw(id: string): Promise<RawComment> {
    const row = await this.surreal.client
      .select<unknown>(new StringRecordId(id))
      .json();
    const c = this.unwrapOne<RawComment | undefined>(row);
    if (!c || !String(c.id ?? id).includes('comment:')) {
      throw new NotFoundException(`Comment not found: ${id}`);
    }
    return this.normalizeComment({ ...c, id: c.id ?? id });
  }

  async createOnPost(
    userId: string,
    postId: string,
    dto: CreateCommentDto,
  ): Promise<CommentWithAuthorDto> {
    const content = dto.content?.trim();
    if (!content) {
      throw new BadRequestException('content là bắt buộc');
    }
    await this.assertPostExists(postId);
    const pid = this.normalizePostRef(postId);

    const created = await this.surreal.client
      .create<unknown>(new Table('comment'))
      .content({
        content,
        author: this.toRecordId('user', userId),
        post_id: this.toRecordId('post', pid),
      })
      .json();
    const row = this.unwrapOne<RawComment>(created);
    const [out] = await this.mapCommentsWithAuthors([this.normalizeComment(row)]);
    return out;
  }

  async createReply(
    userId: string,
    parentCommentId: string,
    dto: CreateCommentDto,
  ): Promise<CommentWithAuthorDto> {
    const content = dto.content?.trim();
    if (!content) {
      throw new BadRequestException('content là bắt buộc');
    }
    const parentRow = await this.loadCommentRaw(parentCommentId);
    const postIdStr = this.normalizePostRef(parentRow.post_id);
    if (!postIdStr.startsWith('post:')) {
      throw new BadRequestException('Bình luận cha thiếu post_id hợp lệ');
    }

    const created = await this.surreal.client
      .create<unknown>(new Table('comment'))
      .content({
        content,
        author: this.toRecordId('user', userId),
        post_id: this.toRecordId('post', postIdStr),
        parent: this.toRecordId('comment', parentCommentId),
      })
      .json();
    const row = this.unwrapOne<RawComment>(created);
    const [out] = await this.mapCommentsWithAuthors([this.normalizeComment(row)]);
    return out;
  }
}
