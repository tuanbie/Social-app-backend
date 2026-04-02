import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { ConversationService } from './conversation.service';
import type { JwtUserPayload } from '../auth/types/jwt-user-payload.type';

type SendPayload = {
  receiverId: string;
  content: string;
};

function firstQuery(
  q: string | string[] | undefined,
): string | undefined {
  if (q == null) return undefined;
  return Array.isArray(q) ? q[0] : q;
}

@Injectable()
@WebSocketGateway({
  path: '/chat',
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 6e6,
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly conversationService: ConversationService,
  ) {}

  private normalizeUserId(raw: unknown): string {
    if (raw == null) return '';
    const s = typeof raw === 'string' ? raw : String(raw);
    return s.startsWith('user:') ? s : `user:${s}`;
  }

  private uidFromPayload(p: JwtUserPayload): string {
    return this.normalizeUserId((p as any).id ?? p.sub);
  }

  private tokenFromHandshake(client: Socket): string | undefined {
    const q = client.handshake.query;
    const fromQuery =
      firstQuery(q.token as string | string[] | undefined) ??
      firstQuery(q.access_token as string | string[] | undefined);
    if (fromQuery) return fromQuery;
    const auth = client.handshake.auth as { token?: string } | undefined;
    if (auth?.token) return auth.token;
    return undefined;
  }

  async handleConnection(client: Socket) {
    try {
      const token = this.tokenFromHandshake(client);
      if (!token) {
        this.logger.warn('Socket.IO: missing token');
        client.disconnect(true);
        return;
      }
      const payload = await this.jwt.verifyAsync<JwtUserPayload>(token);
      const userId = this.uidFromPayload(payload);
      if (!userId) {
        this.logger.warn('Socket.IO: invalid token payload');
        client.disconnect(true);
        return;
      }
      (client.data as { userId: string }).userId = userId;
      await client.join(userId);
      client.emit('connected', { userId });
      this.logger.log(`Socket.IO connected userId=${userId}`);
    } catch (e) {
      this.logger.warn(`Socket.IO auth failed: ${e}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = (client.data as { userId?: string }).userId;
    if (userId) {
      this.logger.log(`Socket.IO disconnected userId=${userId}`);
    }
  }

  private broadcastToUsers(userIds: string[], event: string, data: unknown) {
    const seen = new Set<string>();
    for (const rawId of userIds) {
      const uid = this.normalizeUserId(rawId);
      if (seen.has(uid)) continue;
      seen.add(uid);
      this.server.to(uid).emit(event, data);
    }
  }

  @SubscribeMessage('send_message')
  async onSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: SendPayload,
  ) {
    const senderId = (client.data as { userId?: string }).userId;
    if (!senderId) {
      return { event: 'error', data: { message: 'Unauthorized' } };
    }
    if (!body?.receiverId || !body?.content?.trim()) {
      return {
        event: 'error',
        data: { message: 'receiverId và content là bắt buộc' },
      };
    }
    try {
      const message = await this.conversationService.sendMessage(senderId, {
        receiverId: body.receiverId,
        content: body.content.trim(),
      });
      this.broadcastToUsers(
        [this.normalizeUserId(body.receiverId)],
        'new_message',
        { message },
      );
      return { event: 'sent', data: { message } };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { event: 'error', data: { message: msg } };
    }
  }

  @SubscribeMessage('ping')
  onPing() {
    return { event: 'pong', data: { t: Date.now() } };
  }
}
