import {
  WebSocketGateway, WebSocketServer, OnGatewayConnection,
  OnGatewayDisconnect, SubscribeMessage, MessageBody, ConnectedSocket,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger } from "@nestjs/common";

const tenantSockets = new Map<string, Set<string>>();

@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL ?? "http://localhost:3000", credentials: true },
  namespace: "/events",
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);

  handleConnection(client: Socket) {
    const tenantId = client.handshake.auth["tenantId"] as string;
    if (!tenantId) { client.disconnect(); return; }
    if (!tenantSockets.has(tenantId)) tenantSockets.set(tenantId, new Set());
    tenantSockets.get(tenantId)!.add(client.id);
    void client.join(`tenant:${tenantId}`);
    this.logger.log(`Socket ${client.id} connected for tenant ${tenantId}`);
  }

  handleDisconnect(client: Socket) {
    const tenantId = client.handshake.auth["tenantId"] as string;
    tenantSockets.get(tenantId)?.delete(client.id);
  }

  emitToTenant(tenantId: string, event: object): void {
    this.server.to(`tenant:${tenantId}`).emit("event", event);
  }

  @SubscribeMessage("join_conversation")
  handleJoinConversation(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket,
  ) {
    void client.join(`conv:${data.conversationId}`);
    return { joined: data.conversationId };
  }

  emitToConversation(conversationId: string, event: object): void {
    this.server.to(`conv:${conversationId}`).emit("event", event);
  }
}
