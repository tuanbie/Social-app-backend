import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StringRecordId, Table } from 'surrealdb';
import { SendMessageDto } from './dto/send-message.dto';
import type {
  ConversationListItemEntity,
  MessageEntity,
  OpenConversationResponseEntity,
} from './entities/message.entity';
import { SurrealService } from '../../database/surreal.service';

@Injectable()
export class ConversationService {
  constructor(private readonly surreal: SurrealService) {}

  private toUserRid(value: string): StringRecordId {
    const normalized = value.startsWith('user:') ? value : `user:${value}`;
    return new StringRecordId(normalized);
  }

  private ridString(v: unknown): string {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'object' && v !== null && 'toString' in v) {
      const s = (v as { toString: () => string }).toString();
      return typeof s === 'string' ? s : String(v);
    }
    return String(v);
  }

  private unwrapOne<T>(result: unknown): T {
    if (Array.isArray(result)) return result[0] as T;
    return result as T;
  }

  private normalizeMessage(row: any): MessageEntity {
    const createdAt = row?.created_at;
    return {
      id: this.ridString(row?.id),
      sender: this.ridString(row?.sender),
      conversation: this.ridString(row?.conversation),
      content: String(row?.content ?? ''),
      created_at:
        createdAt instanceof Date
          ? createdAt
          : createdAt
            ? new Date(createdAt)
            : new Date(),
    };
  }

  private async allConversations(): Promise<any[]> {
    return (
      (await this.surreal.client.select<any>(new Table('conversation')).json()) ??
      []
    );
  }

  private async allMessages(): Promise<any[]> {
    return (
      (await this.surreal.client.select<any>(new Table('message')).json()) ?? []
    );
  }

  private async allUserInConv(): Promise<any[]> {
    return (
      (await this.surreal.client.select<any>(new Table('user_in_conv')).json()) ??
      []
    );
  }

  private async messagesInConversationAsync(convId: string): Promise<any[]> {
    const rows = await this.allMessages();
    const cid = this.ridString(convId);
    return rows.filter((m) => this.ridString(m?.conversation) === cid);
  }

  private peerFromParticipants(
    me: string,
    participants: unknown,
  ): string {
    const ids = Array.isArray(participants)
      ? participants.map((p) => this.ridString(p))
      : [];
    return ids.find((id) => id && id !== me) ?? '';
  }

  private findConversationBetween(
    me: string,
    peer: string,
    convs: any[],
  ): any | null {
    for (const c of convs) {
      const parts = Array.isArray(c?.participants)
        ? c.participants.map((p: unknown) => this.ridString(p))
        : [];
      if (
        parts.length === 2 &&
        parts.includes(me) &&
        parts.includes(peer)
      ) {
        return c;
      }
    }
    return null;
  }

  private async ensurePeerUserExists(peerUserId: string): Promise<void> {
    const rid = this.ridString(this.toUserRid(peerUserId));
    const row = await this.surreal.client
      .select<any>(new StringRecordId(rid))
      .json();
    const u = this.unwrapOne<any>(row);
    if (!u) {
      throw new NotFoundException('Không tìm thấy user đối phương');
    }
  }

  /** Tìm conversation 1-1; không tạo mới */
  private async findConversationOnly(
    meUserId: string,
    peerUserId: string,
  ): Promise<any | null> {
    const me = this.ridString(this.toUserRid(meUserId));
    const peer = this.ridString(this.toUserRid(peerUserId));
    const convs = await this.allConversations();
    return this.findConversationBetween(me, peer, convs);
  }

  /**
   * Tạo conversation + 2 cạnh user_in_conv nếu chưa có.
   */
  async getOrCreateConversation(
    meUserId: string,
    peerUserId: string,
  ): Promise<{ id: string; record: any }> {
    const me = this.ridString(this.toUserRid(meUserId));
    const peer = this.ridString(this.toUserRid(peerUserId));
    if (me === peer) {
      throw new BadRequestException('Không tạo chat với chính mình');
    }
    await this.ensurePeerUserExists(peerUserId);

    const convs = await this.allConversations();
    const existing = this.findConversationBetween(me, peer, convs);
    if (existing?.id) {
      const id = this.ridString(existing.id);
      return { id, record: existing };
    }

    const [p1, p2] = [me, peer].sort((a, b) => a.localeCompare(b));
    const created = await this.surreal.client
      .create<any>(new Table('conversation'))
      .content({
        participants: [new StringRecordId(p1), new StringRecordId(p2)],
        updated_at: new Date(),
      })
      .json();

    const conv = this.unwrapOne<any>(created);
    const convId = this.ridString(conv.id);

    const now = new Date();
    await this.surreal.client.relate(
      this.toUserRid(meUserId),
      new Table('user_in_conv'),
      new StringRecordId(convId),
      { last_read_at: now },
    );
    await this.surreal.client.relate(
      this.toUserRid(peerUserId),
      new Table('user_in_conv'),
      new StringRecordId(convId),
      { last_read_at: now },
    );

    return { id: convId, record: conv };
  }

  private async getConversationById(convId: string): Promise<any | null> {
    const row = await this.surreal.client
      .select<any>(new StringRecordId(this.ridString(convId)))
      .json();
    return this.unwrapOne<any>(row) ?? null;
  }

  private async edgeForUserConv(
    userRid: string,
    convId: string,
  ): Promise<any | null> {
    const edges = await this.allUserInConv();
    const c = this.ridString(convId);
    const u = this.ridString(userRid);
    return (
      edges.find(
        (e) => this.ridString(e?.in) === u && this.ridString(e?.out) === c,
      ) ?? null
    );
  }

  /** Snapshot khi đã có edge + messages */
  /** id, name (full_name), avatar — batch cho peer trong conversation. */
  private async fetchPeerSummaries(
    ids: string[],
  ): Promise<
    Map<string, { id: string; name: string | null; avatar: string | null }>
  > {
    const unique = [
      ...new Set(
        ids.filter(Boolean).map((id) => {
          const raw = typeof id === 'string' ? id : String(id);
          return this.ridString(this.toUserRid(raw));
        }),
      ),
    ];
    const map = new Map<
      string,
      { id: string; name: string | null; avatar: string | null }
    >();
    await Promise.all(
      unique.map(async (uid) => {
        try {
          const row = await this.surreal.client
            .select<any>(new StringRecordId(uid))
            .json();
          const u = this.unwrapOne<any>(row);
          if (!u) {
            map.set(uid, { id: uid, name: null, avatar: null });
            return;
          }
          const id = this.ridString(u.id ?? uid);
          map.set(id, {
            id,
            name: u.full_name != null ? String(u.full_name) : null,
            avatar: u.avatar != null ? String(u.avatar) : null,
          });
        } catch {
          map.set(uid, { id: uid, name: null, avatar: null });
        }
      }),
    );
    return map;
  }

  private snapshotSync(
    me: string,
    edge: any,
    messages: any[],
    last: any,
    convRecord: any,
  ): {
    last_message?: string;
    last_message_row?: MessageEntity;
    unread_count: number;
    updated_at?: Date;
  } {
    const lastRead = edge?.last_read_at
      ? new Date(edge.last_read_at)
      : new Date(0);
    const unread = messages.filter((m) => {
      if (this.ridString(m?.sender) === me) return false;
      return new Date(m.created_at ?? 0) > lastRead;
    }).length;
    return {
      last_message: last?.content,
      last_message_row: last ? this.normalizeMessage(last) : undefined,
      unread_count: unread,
      updated_at: convRecord?.updated_at
        ? new Date(convRecord.updated_at)
        : last?.created_at
          ? new Date(last.created_at)
          : undefined,
    };
  }

  async openConversation(
    currentUserId: string,
    peerUserId: string,
  ): Promise<OpenConversationResponseEntity> {
    const me = this.ridString(this.toUserRid(currentUserId));
    const peer = this.ridString(this.toUserRid(peerUserId));
    if (me === peer) {
      throw new BadRequestException('Không mở chat với chính mình');
    }

    const { id: convId, record: conv } = await this.getOrCreateConversation(
      currentUserId,
      peerUserId,
    );
    const peerMap = await this.fetchPeerSummaries([peer]);
    const peerUser =
      peerMap.get(peer) ?? { id: peer, name: null, avatar: null };

    const msgs = (await this.messagesInConversationAsync(convId)).filter(
      (m) => !m?.is_revoked,
    );
    msgs.sort(
      (a, b) =>
        new Date(a.created_at ?? 0).getTime() -
        new Date(b.created_at ?? 0).getTime(),
    );

    if (msgs.length === 0) {
      return {
        is_new: true,
        conversation_id: convId,
        peer_id: peer,
        peer: peerUser,
        unread_count: 0,
      };
    }

    const sortedDesc = [...msgs].sort(
      (a, b) =>
        new Date(b.created_at ?? 0).getTime() -
        new Date(a.created_at ?? 0).getTime(),
    );
    const last = sortedDesc[0];
    const edge = await this.edgeForUserConv(me, convId);
    const snap = this.snapshotSync(me, edge, msgs, last, conv);

    return {
      is_new: false,
      conversation_id: convId,
      peer_id: peer,
      peer: peerUser,
      ...snap,
    };
  }

  async listConversations(
    currentUserId: string,
  ): Promise<ConversationListItemEntity[]> {
    const me = this.ridString(this.toUserRid(currentUserId));
    const edges = await this.allUserInConv();
    const mine = edges.filter((e) => this.ridString(e?.in) === me);

    const rows: Array<{
      convId: string;
      edge: any;
      conv: any;
      peer: string;
      msgs: any[];
    }> = [];

    for (const edge of mine) {
      const convId = this.ridString(edge.out);
      const conv =
        (await this.getConversationById(convId)) ??
        (await this.allConversations()).find(
          (c) => this.ridString(c?.id) === convId,
        );
      if (!conv) continue;

      const peer = this.peerFromParticipants(me, conv.participants);
      if (!peer) continue;

      const msgs = await this.messagesInConversationAsync(convId);
      msgs.sort(
        (a, b) =>
          new Date(b.created_at ?? 0).getTime() -
          new Date(a.created_at ?? 0).getTime(),
      );
      rows.push({ convId, edge, conv, peer, msgs });
    }

    const peerMap = await this.fetchPeerSummaries(rows.map((r) => r.peer));

    const items: ConversationListItemEntity[] = rows.map((r) => {
      const last = r.msgs[0];
      const snap = this.snapshotSync(me, r.edge, r.msgs, last, r.conv);
      const peerUser =
        peerMap.get(r.peer) ?? { id: r.peer, name: null, avatar: null };
      return {
        conversation_id: r.convId,
        peer_id: r.peer,
        peer: peerUser,
        ...snap,
      };
    });

    items.sort(
      (a, b) =>
        (b.updated_at?.getTime() ?? 0) - (a.updated_at?.getTime() ?? 0),
    );
    return items;
  }

  async getMessagesWithPeer(
    currentUserId: string,
    peerUserId: string,
    limit = 50,
  ): Promise<MessageEntity[]> {
    const me = this.ridString(this.toUserRid(currentUserId));
    const peer = this.ridString(this.toUserRid(peerUserId));
    if (me === peer) {
      throw new BadRequestException('Không chat với chính mình');
    }

    const conv = await this.findConversationOnly(currentUserId, peerUserId);
    if (!conv?.id) {
      return [];
    }

    const convId = this.ridString(conv.id);
    const msgs = await this.messagesInConversationAsync(convId);
    msgs.sort(
      (a, b) =>
        new Date(a.created_at ?? 0).getTime() -
        new Date(b.created_at ?? 0).getTime(),
    );
    const slice = msgs.slice(-Math.min(limit, 200));
    return slice.map((m) => this.normalizeMessage(m));
  }

  async sendMessage(
    senderUserId: string,
    dto: SendMessageDto,
  ): Promise<MessageEntity> {
    const sender = this.ridString(this.toUserRid(senderUserId));
    const receiver = this.ridString(this.toUserRid(dto.receiverId));
    if (sender === receiver) {
      throw new BadRequestException('Không gửi tin cho chính mình');
    }

    const { id: convId } = await this.getOrCreateConversation(
      senderUserId,
      dto.receiverId,
    );

    const created = await this.surreal.client
      .create<any>(new Table('message'))
      .content({
        content: dto.content,
        sender: this.toUserRid(senderUserId),
        conversation: new StringRecordId(convId),
      })
      .json();

    const now = new Date();
    // merge — không dùng .content() (sẽ thay cả record, participants thành NONE)
    await this.surreal.client
      .update<any>(new StringRecordId(convId))
      .merge({ updated_at: now })
      .json();

    const row = this.unwrapOne<any>(created);
    return this.normalizeMessage(row);
  }

  /**
   * Cập nhật last_read_at trên cạnh user_in_conv (in = current user, out = conversation).
   */
  async markConversationRead(
    currentUserId: string,
    peerUserId: string,
  ): Promise<number> {
    const me = this.ridString(this.toUserRid(currentUserId));
    const conv = await this.findConversationOnly(currentUserId, peerUserId);
    if (!conv?.id) {
      return 0;
    }
    const convId = this.ridString(conv.id);

    const edge = await this.edgeForUserConv(me, convId);
    if (!edge?.id) {
      return 0;
    }

    await this.surreal.client
      .update<any>(new StringRecordId(this.ridString(edge.id)))
      .merge({ last_read_at: new Date() })
      .json();

    return 1;
  }
}
