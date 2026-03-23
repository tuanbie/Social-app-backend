import { Injectable, NotFoundException } from '@nestjs/common';
import { SurrealService } from '../../database/surreal.service';
import { CreatePostInput } from './dto/create-post.input';
import { UpdatePostInput } from './dto/update-post.input';
import { Post, PostStatus } from './entities/post.entity';
import { StringRecordId, Table } from 'surrealdb';

@Injectable()
export class PostService {
  constructor(private readonly surreal: SurrealService) {}

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

  async create(createPostInput: CreatePostInput): Promise<Post> {
    const payload = {
      content: createPostInput.content ?? null,
      image: createPostInput.image ?? null,
      files: createPostInput.files ?? [],
      author: createPostInput.authorId,
      status: createPostInput.status ?? PostStatus.published,
      // created_at để DB default time::now()
    };

    const created = await this.surreal.client
      .create<Post>(new Table('post'))
      .content(payload)
      .json();
    return this.normalize(this.unwrapOne<Post>(created));
  }

  async findAll(): Promise<Post[]> {
    const rows = await this.surreal.client
      .select<Post>(new Table('post'))
      .json();
    return (rows ?? []).map((p) => this.normalize(p));
  }

  async findOne(id: string): Promise<Post> {
    const row = await this.surreal.client
      .select<Post>(new StringRecordId(id))
      .json();
    const post = this.unwrapOne<Post | undefined>(row);
    if (!post) throw new NotFoundException(`Post not found: ${id}`);
    return this.normalize(post);
  }

  async update(id: string, updatePostInput: UpdatePostInput): Promise<Post> {
    const patch: Record<string, unknown> = {};
    if (updatePostInput.content !== undefined) patch.content = updatePostInput.content;
    if (updatePostInput.image !== undefined) patch.image = updatePostInput.image;
    if (updatePostInput.files !== undefined) patch.files = updatePostInput.files;
    if (updatePostInput.authorId !== undefined) patch.author = updatePostInput.authorId;
    if (updatePostInput.status !== undefined) patch.status = updatePostInput.status;

    const merged = await this.surreal.client
      .update<Post>(new StringRecordId(id))
      .merge(patch)
      .json();
    const post = this.unwrapOne<Post | undefined>(merged);
    if (!post) throw new NotFoundException(`Post not found: ${id}`);
    return this.normalize(post);
  }

  async remove(id: string): Promise<Post> {
    const deleted = await this.surreal.client
      .delete<Post>(new StringRecordId(id))
      .json();
    const post = this.unwrapOne<Post | undefined>(deleted);
    if (!post) throw new NotFoundException(`Post not found: ${id}`);
    return this.normalize(post);
  }
}
