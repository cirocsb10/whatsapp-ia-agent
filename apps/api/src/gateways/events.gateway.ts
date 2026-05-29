import {
  WebSocketGateway, WebSocketServer, OnGatewayConnection,
  OnGatewayDisconnect, SubscribeMessage, MessageBody, ConnectedSocket,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger } from "@nestjs/common";
import { verifyToken } from "@clerk/backend";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../common/prisma/prisma.service";

const tenantSockets = new Map<string, Set<string>>();

@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL ?? "http://localhost:3000", credentials: true },
  namespace: "/events",
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth["token"] as string | undefined;
    const claimedTenantId = client.handshake.auth["tenantId"] as string | undefined;

    if (!token || !claimedTenantId) {
      this.logger.warn(`Socket ${client.id} rejected: missing token or tenantId`);
      client.disconnect();
      return;
    }

    try {
      const secretKey = this.config.get<string>("CLERK_SECRET_KEY") ?? "";
      const payload = await verifyToken(token, { secretKey });
      const user = await this.prisma.user.findUnique({
        where: { clerkId: payload.sub },
        select: { tenantId: true },
      });

      if (!user || user.tenantId !== claimedTenantId) {
        this.logger.warn(`Socket ${client.id} rejected: tenant mismatch`);
        client.disconnect();
        return;
      }
    } catch {
      this.logger.warn(`Socket ${client.id} rejected: invalid token`);
      client.disconnect();
      return;
    }

    if (!tenantSockets.has(claimedTenantId)) tenantSockets.set(claimedTenantId, new Set());
    tenantSockets.get(claimedTenantId)!.add(client.id);
    void client.join(`tenant:${claimedTenantId}`);
    this.logger.log(`Socket ${client.id} authenticated for tenant ${claimedTenantId}`);
  }

  handleDisconnect(client: Socket) {
    const tenantId = client.handshake.auth["tenantId"] as string;
    tenantSockets.get(tenantId)?.delete(client.id);
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
    const tenantId = client.handshake.auth["tenantId"] as string;
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
