-- CreateTable
CREATE TABLE "PlatformSmtpSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "host" TEXT,
    "port" INTEGER NOT NULL DEFAULT 587,
    "username" TEXT,
    "passwordEncrypted" TEXT,
    "secure" BOOLEAN NOT NULL DEFAULT false,
    "fromEmail" TEXT,
    "fromName" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSmtpSettings_pkey" PRIMARY KEY ("id")
);
