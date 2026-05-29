export interface ConversationSession {
  tenantId: string;
  conversationId: string;
  contactPhone: string;
  currentStage: ConversationStage;
  cart: CartItem[];
  lastMessages: MessageSummary[];
  agentContext: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export type ConversationStage =
  | "greeting"
  | "discovery"
  | "catalog"
  | "negotiation"
  | "payment"
  | "post_payment"
  | "closed"
  | "handoff";

export interface CartItem {
  productId: string;
  productName: string;
  priceCents: number;
  quantity: number;
  variationSelected?: Record<string, string>;
}

export interface MessageSummary {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export type WsEvent =
  | { type: "new_message"; payload: WsNewMessage }
  | { type: "conversation_status"; payload: WsConvStatus }
  | { type: "handoff_created"; payload: WsHandoff }
  | { type: "agent_typing"; payload: { conversationId: string } }
  | { type: "order_updated"; payload: WsOrderUpdate };

export interface WsNewMessage {
  conversationId: string;
  tenantId: string;
  messageId: string;
  direction: "inbound" | "outbound";
  type: string;
  text?: string;
  audioUrl?: string;
  sentAt: string;
  isFromAi: boolean;
}

export interface WsConvStatus {
  conversationId: string;
  status: string;
  assignedUserId?: string;
}

export interface WsHandoff {
  conversationId: string;
  contactPhone: string;
  contactName?: string;
  reason: string;
  urgency: string;
  createdAt: string;
}

export interface WsOrderUpdate {
  orderId: string;
  orderNumber: string;
  status: string;
  totalCents: number;
}
