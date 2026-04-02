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
