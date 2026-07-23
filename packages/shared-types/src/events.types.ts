export const EXCHANGES = {
  MESSAGES: "messages",
  AI: "ai",
  NOTIFICATIONS: "notifications",
  HANDOFF: "handoff",
} as const;

export const ROUTING_KEYS = {
  MSG_INBOUND: "msg.inbound",
  MSG_OUTBOUND: "msg.outbound",
  AI_PROCESS: "ai.process",
  AI_RESPONSE: "ai.response",
  AI_STREAM: "ai.stream",
  HANDOFF_CREATE: "handoff.create",
  HANDOFF_ACCEPT: "handoff.accept",
  NOTIFICATION_PUSH: "notification.push",
  CAMPAIGN_STATUS: "campaign.status",
} as const;

export interface InboundMessageEvent {
  tenantId: string;
  channelId?: string;
  whatsappPhoneId: string;
  waMessageId: string;
  from: string;
  timestamp: number;
  type: "text" | "audio" | "image" | "document" | "location";
  text?: string;
  audioId?: string;
  audioUrl?: string;
  audioTranscript?: string;
  imageId?: string;
  imageUrl?: string;
  documentId?: string;
  documentUrl?: string;
  documentName?: string;
  locationLat?: number;
  locationLng?: number;
}

export interface AiResponseEvent {
  tenantId: string;
  channelId?: string;
  conversationId: string;
  waPhoneId: string;
  toPhone: string;
  messages: OutboundMessage[];
  triggerHandoff?: boolean;
  handoffReason?: string;
}

export interface OutboundMessage {
  type: "text" | "image" | "template";
  text?: string;
  imageUrl?: string;
  templateName?: string;
  templateParams?: string[];
}

export interface CampaignStatusEvent {
  tenantId: string;
  waMessageId: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: number;
  failureReason?: string;
}

export interface HandoffCreatedEvent {
  tenantId: string;
  conversationId: string;
  contactId: string;
  contactPhone: string;
  contactName?: string;
  reason: string;
  urgency: "low" | "medium" | "high";
}

export interface PushNotificationEvent {
  tenantId: string;
  targetUserIds?: string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
  type: "handoff" | "order" | "payment" | "alert";
}
