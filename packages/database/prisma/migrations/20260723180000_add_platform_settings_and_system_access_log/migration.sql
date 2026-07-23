-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "maintenanceMessage" TEXT,
    "newTenantRegistrationOpen" BOOLEAN NOT NULL DEFAULT true,
    "defaultTrialDays" INTEGER NOT NULL DEFAULT 7,
    "defaultConversationsLimit" INTEGER NOT NULL DEFAULT 100,
    "planConversationLimits" JSONB NOT NULL DEFAULT '{"STARTER":100,"GROWTH":1000,"SCALE":5000,"ENTERPRISE":20000}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemAccessLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "userId" TEXT,
    "userEmail" TEXT,
    "method" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "payload" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "duration" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SystemAccessLog_createdAt_idx" ON "SystemAccessLog"("createdAt");

-- CreateIndex
CREATE INDEX "SystemAccessLog_tenantId_createdAt_idx" ON "SystemAccessLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "SystemAccessLog_userId_idx" ON "SystemAccessLog"("userId");

-- CreateIndex
CREATE INDEX "SystemAccessLog_method_idx" ON "SystemAccessLog"("method");
