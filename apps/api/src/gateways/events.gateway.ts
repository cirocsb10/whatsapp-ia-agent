import {
  WebSocketGateway, WebSocketServer, OnGatewayConnection,
  OnGatewayDisconnect, SubscribeMessage, MessageBody, ConnectedSocket,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Inject, Logger } from "@nestjs/common";
import { Redis } from "ioredis";
import { PrismaService } from "../common/prisma/prisma.service";
import { REDIS_CLIENT } from "../common/redis/redis.module";

const tenantSockets = new Map<string, Set<string>>();
const SOCKET_TICKET_PREFIX = "socket-ticket:";

@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL ?? "http://localhost:3000", credentials: true },
  namespace: "/events",
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async handleConnection(client: Socket) {
    const ticket = client.handshake.auth["ticket"] as string | undefined;

    if (!ticket) {
      this.logger.warn(`Socket ${client.id} rejected: missing ticket`);
      client.disconnect();
      return;
    }

    try {
      const key = `${SOCKET_TICKET_PREFIX}${ticket}`;
      const userId = await this.redis.get(key);

      if (!userId) {
        this.logger.warn(`Socket ${client.id} rejected: invalid or expired ticket`);
        client.disconnect();
        return;
      }

      // Ticket de uso único.
      await this.redis.del(key);

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { tenantId: true, isActive: true },
      });

      if (!user || !user.isActive) {
        this.logger.warn(`Socket ${client.id} rejected: user not found or inactive`);
        client.disconnect();
        return;
      }

      const tenantId = user.tenantId;
      if (!tenantSockets.has(tenantId)) tenantSockets.set(tenantId, new Set());
      tenantSockets.get(tenantId)!.add(client.id);
      void client.join(`tenant:${tenantId}`);
      // Store tenantId on socket data for disconnect cleanup
      (client as any).tenantId = tenantId;
      this.logger.log(`Socket ${client.id} authenticated for tenant ${tenantId}`);
    } catch {
      this.logger.warn(`Socket ${client.id} rejected: authentication error`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const tenantId = (client as any).tenantId as string | undefined;
    if (tenantId) tenantSockets.get(tenantId)?.delete(client.id);
  }

  emitToTenant(tenantId: string, event: object): void {
    this.server.to(`tenant:${tenantId}`).emit("event", event);
  }

  @SubscribeMessage("join_conversation")
  async handleJoinConversation(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket,
  ) {
    // Verify conversation belongs to client's tenant before joining
    const tenantId = (client as any).tenantId as string;
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: data.conversationId, tenantId },
      select: { id: true },
    });
    if (!conversation) {
      return { error: "Conversation not found" };
    }
    void client.join(`conv:${data.conversationId}`);
    return { joined: data.conversationId };
  }

  emitToConversation(conversationId: string, event: object): void {
    this.server.to(`conv:${conversationId}`).emit("event", event);
  }
}
