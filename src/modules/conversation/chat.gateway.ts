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
import type { IncomingMessage } from 'http';
import { WebSocket } from 'ws';
import { ConversationService } from './conversation.service';
import type { JwtUserPayload } from '../auth/types/jwt-user-payload.type';

type SendPayload = {
  receiverId: string;
  content: string;
};

@Injectable()
@WebSocketGateway({
  transports: ['websocket', 'polling'],
  path: '/chat',
  cors: { origin: '*' },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: import('ws').Server;

  private readonly logger = new Logger(ChatGateway.name);
  private readonly socketUser = new WeakMap<WebSocket, string>();
  private readonly userSockets = new Map<string, Set<WebSocket>>();

  constructor(
    private readonly jwt: JwtService,
    private readonly conversationService: ConversationService,
  ) { }

  private normalizeUserId(raw: unknown): string {
    if (raw == null) return '';
    const s = typeof raw === 'string' ? raw : String(raw);
    return s.startsWith('user:') ? s : `user:${s}`;
  }

  private uidFromPayload(p: JwtUserPayload): string {
    return this.normalizeUserId((p as any).id ?? p.sub);
  }

  async handleConnection(client: WebSocket, req: IncomingMessage) {
    try {
      const host = req.headers.host ?? 'localhost';
      const url = new URL(req.url ?? '/', `http://${host}`);
      const token =
        url.searchParams.get('token') ??
        url.searchParams.get('access_token');
      if (!token) {
        client.close(4001, 'Missing token');
        return;
      }
      const payload = await this.jwt.verifyAsync<JwtUserPayload>(token);
      const userId = this.uidFromPayload(payload);
      if (!userId) {
        client.close(4001, 'Invalid token payload');
        return;
      }
      this.socketUser.set(client, userId);
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client);
      client.send(
        JSON.stringify({
          event: 'connected',
          data: { userId },
        }),
      );
    } catch (e) {
      this.logger.warn(`WS auth failed: ${e}`);
      client.close(4001, 'Unauthorized');
    }
  }

  handleDisconnect(client: WebSocket) {
    const userId = this.socketUser.get(client);
    if (!userId) return;
    const set = this.userSockets.get(userId);
    if (set) {
      set.delete(client);
      if (set.size === 0) this.userSockets.delete(userId);
    }
    this.socketUser.delete(client);
  }

  private broadcastToUsers(userIds: string[], payload: object) {
    const line = JSON.stringify(payload);
    const seen = new Set<string>();
    for (const rawId of userIds) {
      const uid = this.normalizeUserId(rawId);
      if (seen.has(uid)) continue;
      seen.add(uid);
      const sockets = this.userSockets.get(uid);
      if (!sockets) continue;
      for (const ws of sockets) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(line);
        }
      }
    }
  }

  @SubscribeMessage('send_message')
  async onSend(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() body: SendPayload,
  ) {
    const senderId = this.socketUser.get(client);
    if (!senderId) {
      return { event: 'error', data: { message: 'Unauthorized' } };
    }
    if (!body?.receiverId || !body?.content?.trim()) {
      return { event: 'error', data: { message: 'receiverId và content là bắt buộc' } };
    }
    try {
      const message = await this.conversationService.sendMessage(senderId, {
        receiverId: body.receiverId,
        content: body.content.trim(),
      });
      const payload = {
        event: 'new_message',
        data: { message },
      };
      this.broadcastToUsers([this.normalizeUserId(body.receiverId)], payload);
      // return { event: 'sent', data: { message } };
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
