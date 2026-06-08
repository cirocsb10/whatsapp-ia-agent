export interface InactivityJobData {
  conversationId: string;
  tenantId: string;
  contactPhone: string;
  waPhoneId: string;
  phase: "warn" | "close";
  scheduledAt: number;
}
