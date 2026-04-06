import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StringRecordId, Table } from 'surrealdb';
import { SurrealService } from '../../database/surreal.service';
import { ChatGateway } from '../conversation/chat.gateway';
import { NotificationListQueryDto } from './dto/notification-list-query.dto';

export type NotificationAction =
  | 'LIKE'
  | 'COMMENT'
  | 'FRIEND_REQ'
  | 'FRIEND_ACCEPT';

type CursorPayload = { t: string; id: string };

@Injectable()
export class NotificationService {
  constructor(
    private readonly surreal: SurrealService,
    private readonly chatGateway: ChatGateway,
  ) {}

  private asUserRid(userId: string): string {
    return userId.includes(':') ? userId : `user:${userId}`;
  }

  private asNotificationRid(id: string): string {
    return id.includes(':') ? id : `notification:${id}`;
  }

  private unwrapOne<T>(result: unknown): T {
    if (Array.isArray(result)) return result[0] as T;
    return result as T;
  }

  private encodeCursor(createdAt: Date, id: string): string {
    const t =
      createdAt instanceof Date
        ? createdAt.toISOString()
        : new Date(createdAt as string | number).toISOString();
    const payload: CursorPayload = { t, id: String(id) };
    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  }

  private decodeCursor(cursor: string): CursorPayload {
    try {
      const raw = Buffer.from(cursor, 'base64url').toString('utf8');
      const j = JSON.parse(raw) as CursorPayload;
      if (!j?.t || !j?.id) throw new Error('bad cursor');
      return j;
    } catch {
      throw new BadRequestException('Invalid cursor');
    }
  }

  private async fetchUserPreviewMap(ids: string[]) {
    const unique = [...new Set(ids.map((x) => this.asUserRid(x)).filter(Boolean))];
    const map = new Map<string, { id: string; full_name: unknown; username: unknown; avatar: unknown }>();
    await Promise.all(
      unique.map(async (id) => {
        try {
          const row = await this.surreal.client
            .select<Record<string, unknown>>(new StringRecordId(id))
            .json();
          const u = this.unwrapOne<Record<string, unknown> | null>(row);
          if (!u) return;
          const uid = this.asUserRid(String(u.id ?? id));
          map.set(uid, {
            id: uid,
            full_name: u.full_name ?? null,
            username: u.username ?? null,
            avatar: u.avatar ?? null,
          });
        } catch {
          // skip
        }
      }),
    );
    return map;
  }

  private normalizeRow(row: Record<string, unknown>) {
    const ca = row?.created_at;
    const created_at =
      ca instanceof Date
        ? ca
        : ca != null
          ? new Date(ca as string | number)
          : new Date();
    return {
      id: String(row?.id ?? ''),
      receiver: String(row?.receiver ?? ''),
      actor: String(row?.actor ?? ''),
      action: String(row?.action ?? '') as NotificationAction,
      target_id: String(row?.target_id ?? ''),
      is_read: Boolean(row?.is_read ?? false),
      created_at,
    };
  }

  private async mapRowsWithActor(rows: Record<string, unknown>[]) {
    const actorIds = rows.map((r) => String(r?.actor ?? ''));
    const umap = await this.fetchUserPreviewMap(actorIds);
    return rows.map((r) => {
      const n = this.normalizeRow(r);
      const ap = umap.get(this.asUserRid(n.actor)) ?? {
        id: this.asUserRid(n.actor),
        full_name: null,
        username: null,
        avatar: null,
      };
      return {
        ...n,
        actor_user: ap,
      };
    });
  }

  async notifyFriendRequest(
    receiverUserId: string,
    actorUserId: string,
    friendEdgeId: string,
  ) {
    return this.createAndEmit(
      receiverUserId,
      actorUserId,
      'FRIEND_REQ',
      friendEdgeId,
    );
  }

  async notifyFriendAccepted(
    receiverUserId: string,
    actorUserId: string,
    friendEdgeId: string,
  ) {
    return this.createAndEmit(
      receiverUserId,
      actorUserId,
      'FRIEND_ACCEPT',
      friendEdgeId,
    );
  }

  private async createAndEmit(
    receiverUserId: string,
    actorUserId: string,
    action: NotificationAction,
    targetRecordId: string,
  ) {
    const receiverRid = this.asUserRid(receiverUserId);
    const actorRid = this.asUserRid(actorUserId);
    const tid = targetRecordId.includes(':')
      ? targetRecordId
      : `friend:${targetRecordId}`;

    const created = await this.surreal.client
      .create<Record<string, unknown>>(new Table('notification'))
      .content({
        receiver: new StringRecordId(receiverRid),
        actor: new StringRecordId(actorRid),
        action,
        target_id: new StringRecordId(tid),
        is_read: false,
      })
      .json();

    const row = this.unwrapOne<Record<string, unknown> | null>(created);
    if (!row) return null;

    const [mapped] = await this.mapRowsWithActor([row]);
    this.chatGateway.emitToUser(receiverRid, 'new_notification', {
      notification: mapped,
    });
    return mapped;
  }

  async countUnread(userId: string): Promise<number> {
    const rid = this.asUserRid(userId);
    const [rows] = await this.surreal.client
      .query(
        `SELECT count() AS count FROM notification WHERE receiver = $r AND is_read = false`,
        { r: new StringRecordId(rid) },
      )
      .collect<[{ count: number }[]]>();
    const row = rows?.[0];
    const n = row?.count;
    return typeof n === 'number' ? n : Number(n ?? 0);
  }

  async listForUser(userId: string, query: NotificationListQueryDto) {
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const rid = this.asUserRid(userId);

    let sql = `SELECT * FROM notification WHERE receiver = $receiver`;
    const vars: Record<string, unknown> = {
      receiver: new StringRecordId(rid),
      lim: limit + 1,
    };

    if (query.cursor?.trim()) {
      const { t, id } = this.decodeCursor(query.cursor.trim());
      vars.ct = new Date(t);
      vars.cid = new StringRecordId(this.asNotificationRid(id));
      sql += ` AND (created_at < $ct OR (created_at = $ct AND id < $cid))`;
    }

    sql += ` ORDER BY created_at DESC, id DESC LIMIT $lim`;

    const [rowsRaw] = await this.surreal.client
      .query(sql, vars)
      .collect<[Record<string, unknown>[]]>();
    const rows = (Array.isArray(rowsRaw) ? rowsRaw : []) as Record<
      string,
      unknown
    >[];

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const items = await this.mapRowsWithActor(pageRows);

    let next_cursor: string | null = null;
    if (hasMore && pageRows.length > 0) {
      const last = pageRows[pageRows.length - 1];
      const n = this.normalizeRow(last);
      next_cursor = this.encodeCursor(n.created_at, n.id);
    }

    return {
      items,
      next_cursor,
      has_more: hasMore,
    };
  }

  async markAsRead(currentUserId: string, notificationParamId: string) {
    const viewerRid = this.asUserRid(currentUserId);
    const nid = this.asNotificationRid(notificationParamId);

    const row = await this.surreal.client
      .select<Record<string, unknown>>(new StringRecordId(nid))
      .json();
    const n = this.unwrapOne<Record<string, unknown> | null>(row);
    if (!n) throw new NotFoundException('Notification not found');

    const recv = String(n.receiver ?? '');
    if (this.asUserRid(recv) !== viewerRid) {
      throw new ForbiddenException('Not your notification');
    }

    const updated = await this.surreal.client
      .update<Record<string, unknown>>(new StringRecordId(nid))
      .merge({ is_read: true })
      .json();
    const out = this.unwrapOne<Record<string, unknown> | null>(updated);
    if (!out) throw new NotFoundException('Notification not found');
    const [mapped] = await this.mapRowsWithActor([out]);
    return mapped;
  }
}
