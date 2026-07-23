-- CreateEnum
CREATE TYPE "WhatsappChannelStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'COMPLETED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "CampaignRecipientStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "MessageTemplateStatus" AS ENUM ('APPROVED', 'PENDING', 'REJECTED', 'PAUSED', 'DISABLED');

-- AlterTable
ALTER TABLE "AgentConfig" ADD COLUMN "crmProgressionEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN "channelId" TEXT;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN "sentByUserId" TEXT,
ADD COLUMN "pricingCategory" TEXT;

-- CreateTable
CREATE TABLE "WhatsappChannel" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "whatsappPhoneId" TEXT NOT NULL,
    "whatsappNumber" TEXT,
    "metaAccessToken" TEXT,
    "wabaId" TEXT,
    "status" "WhatsappChannelStatus" NOT NULL DEFAULT 'ACTIVE',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isAiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappChannelMember" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsappChannelMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessagePricingRate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "category" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'BR',
    "priceBrlCents" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessagePricingRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "category" TEXT,
    "status" "MessageTemplateStatus" NOT NULL DEFAULT 'PENDING',
    "bodyText" TEXT,
    "variables" JSONB,
    "metaId" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "audienceQuery" JSONB NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignRecipient" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "status" "CampaignRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "waMessageId" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,

    CONSTRAINT "CampaignRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappChannel_whatsappPhoneId_key" ON "WhatsappChannel"("whatsappPhoneId");

-- CreateIndex
CREATE INDEX "WhatsappChannel_tenantId_idx" ON "WhatsappChannel"("tenantId");

-- CreateIndex
CREATE INDEX "WhatsappChannel_tenantId_isDefault_idx" ON "WhatsappChannel"("tenantId", "isDefault");

-- CreateIndex
CREATE INDEX "WhatsappChannelMember_userId_idx" ON "WhatsappChannelMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappChannelMember_channelId_userId_key" ON "WhatsappChannelMember"("channelId", "userId");

-- CreateIndex
CREATE INDEX "MessagePricingRate_tenantId_category_countryCode_idx" ON "MessagePricingRate"("tenantId", "category", "countryCode");

-- CreateIndex
CREATE INDEX "MessagePricingRate_category_countryCode_effectiveFrom_idx" ON "MessagePricingRate"("category", "countryCode", "effectiveFrom");

-- CreateIndex
CREATE INDEX "MessageTemplate_tenantId_idx" ON "MessageTemplate"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageTemplate_channelId_name_language_key" ON "MessageTemplate"("channelId", "name", "language");

-- CreateIndex
CREATE INDEX "Campaign_tenantId_status_idx" ON "Campaign"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignRecipient_waMessageId_key" ON "CampaignRecipient"("waMessageId");

-- CreateIndex
CREATE INDEX "CampaignRecipient_waMessageId_idx" ON "CampaignRecipient"("waMessageId");

-- CreateIndex
CREATE INDEX "CampaignRecipient_campaignId_status_idx" ON "CampaignRecipient"("campaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignRecipient_campaignId_contactId_key" ON "CampaignRecipient"("campaignId", "contactId");

-- CreateIndex
CREATE INDEX "Conversation_tenantId_channelId_idx" ON "Conversation"("tenantId", "channelId");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "WhatsappChannel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappChannel" ADD CONSTRAINT "WhatsappChannel_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappChannelMember" ADD CONSTRAINT "WhatsappChannelMember_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "WhatsappChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappChannelMember" ADD CONSTRAINT "WhatsappChannelMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagePricingRate" ADD CONSTRAINT "MessagePricingRate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageTemplate" ADD CONSTRAINT "MessageTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageTemplate" ADD CONSTRAINT "MessageTemplate_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "WhatsappChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "WhatsappChannel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MessageTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignRecipient" ADD CONSTRAINT "CampaignRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignRecipient" ADD CONSTRAINT "CampaignRecipient_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: one default WhatsappChannel per tenant that already has a phone id.
-- isAiEnabled is copied from AgentConfig.isPublished (not the column default alone).
-- displayName uses COALESCE(whatsappNumber, 'Número principal').
-- Table names use PascalCase to match existing Prisma conventions (no @@map).
INSERT INTO "WhatsappChannel" (
  id, "tenantId", "displayName", "whatsappPhoneId", "whatsappNumber",
  "metaAccessToken", status, "isDefault", "isAiEnabled", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  t.id,
  COALESCE(t."whatsappNumber", 'Número principal'),
  t."whatsappPhoneId",
  t."whatsappNumber",
  t."metaAccessToken",
  'ACTIVE',
  true,
  COALESCE(ac."isPublished", false),
  NOW(), NOW()
FROM "Tenant" t
LEFT JOIN "AgentConfig" ac ON ac."tenantId" = t.id
WHERE t."whatsappPhoneId" IS NOT NULL;

UPDATE "Conversation" c
SET "channelId" = wc.id
FROM "WhatsappChannel" wc
WHERE wc."tenantId" = c."tenantId" AND wc."isDefault" = true AND c."channelId" IS NULL;
