-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('CUSTOMER', 'ADMIN', 'SUPPORT');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "phone" TEXT,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "backupCodes" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "role" TEXT NOT NULL DEFAULT 'CUSTOMER',
    "stripeCustomerId" TEXT,
    "preferredCurrency" TEXT NOT NULL DEFAULT 'cad',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" TEXT,
    "accessToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "accountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idToken" TEXT,
    "password" TEXT,
    "providerId" TEXT NOT NULL,
    "refreshToken" TEXT,
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "verificationToken" TEXT,
    "resetToken" TEXT,
    "resetTokenExpiresAt" TIMESTAMP(3),
    "resetTokenHash" TEXT,
    "resetRequestIp" TEXT,
    "resetRequestUserAgent" TEXT,
    "twoFactorSecret" TEXT,
    "backupCodes" TEXT[],

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "token" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."email_rate_limits" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 1,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_rate_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."password_reset_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ip_rate_limits" (
    "id" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 1,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ip_rate_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."security_audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "eventType" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "eventData" JSONB,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "sessionId" TEXT,
    "requestId" TEXT,
    "resource" TEXT,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_stripeCustomerId_key" ON "public"."users"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "public"."users"("role");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "public"."users"("createdAt");

-- CreateIndex
CREATE INDEX "users_twoFactorEnabled_idx" ON "public"."users"("twoFactorEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_verificationToken_key" ON "public"."accounts"("verificationToken");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_resetToken_key" ON "public"."accounts"("resetToken");

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "public"."accounts"("userId");

-- CreateIndex
CREATE INDEX "accounts_verificationToken_idx" ON "public"."accounts"("verificationToken");

-- CreateIndex
CREATE INDEX "accounts_resetToken_idx" ON "public"."accounts"("resetToken");

-- CreateIndex
CREATE INDEX "accounts_resetTokenHash_idx" ON "public"."accounts"("resetTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_providerId_accountId_key" ON "public"."accounts"("providerId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "public"."sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "public"."sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "public"."sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "sessions_token_idx" ON "public"."sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_isActive_idx" ON "public"."sessions"("isActive");

-- CreateIndex
CREATE INDEX "email_rate_limits_email_idx" ON "public"."email_rate_limits"("email");

-- CreateIndex
CREATE INDEX "email_rate_limits_type_idx" ON "public"."email_rate_limits"("type");

-- CreateIndex
CREATE INDEX "email_rate_limits_windowStart_idx" ON "public"."email_rate_limits"("windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "email_rate_limits_email_type_key" ON "public"."email_rate_limits"("email", "type");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "public"."password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_idx" ON "public"."password_reset_tokens"("userId");

-- CreateIndex
CREATE INDEX "password_reset_tokens_tokenHash_idx" ON "public"."password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_expiresAt_idx" ON "public"."password_reset_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "password_reset_tokens_ipAddress_idx" ON "public"."password_reset_tokens"("ipAddress");

-- CreateIndex
CREATE INDEX "password_reset_tokens_isUsed_idx" ON "public"."password_reset_tokens"("isUsed");

-- CreateIndex
CREATE INDEX "ip_rate_limits_ipAddress_idx" ON "public"."ip_rate_limits"("ipAddress");

-- CreateIndex
CREATE INDEX "ip_rate_limits_action_idx" ON "public"."ip_rate_limits"("action");

-- CreateIndex
CREATE INDEX "ip_rate_limits_windowStart_idx" ON "public"."ip_rate_limits"("windowStart");

-- CreateIndex
CREATE INDEX "ip_rate_limits_blockedUntil_idx" ON "public"."ip_rate_limits"("blockedUntil");

-- CreateIndex
CREATE UNIQUE INDEX "ip_rate_limits_ipAddress_action_key" ON "public"."ip_rate_limits"("ipAddress", "action");

-- CreateIndex
CREATE INDEX "security_audit_logs_userId_idx" ON "public"."security_audit_logs"("userId");

-- CreateIndex
CREATE INDEX "security_audit_logs_email_idx" ON "public"."security_audit_logs"("email");

-- CreateIndex
CREATE INDEX "security_audit_logs_eventType_idx" ON "public"."security_audit_logs"("eventType");

-- CreateIndex
CREATE INDEX "security_audit_logs_action_idx" ON "public"."security_audit_logs"("action");

-- CreateIndex
CREATE INDEX "security_audit_logs_success_idx" ON "public"."security_audit_logs"("success");

-- CreateIndex
CREATE INDEX "security_audit_logs_severity_idx" ON "public"."security_audit_logs"("severity");

-- CreateIndex
CREATE INDEX "security_audit_logs_createdAt_idx" ON "public"."security_audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "security_audit_logs_ipAddress_idx" ON "public"."security_audit_logs"("ipAddress");

-- CreateIndex
CREATE INDEX "security_audit_logs_sessionId_idx" ON "public"."security_audit_logs"("sessionId");

-- CreateIndex
CREATE INDEX "security_audit_logs_requestId_idx" ON "public"."security_audit_logs"("requestId");

-- CreateIndex
CREATE INDEX "security_audit_logs_checksum_idx" ON "public"."security_audit_logs"("checksum");

-- CreateIndex
CREATE INDEX "security_audit_logs_userId_eventType_createdAt_idx" ON "public"."security_audit_logs"("userId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "security_audit_logs_eventType_success_createdAt_idx" ON "public"."security_audit_logs"("eventType", "success", "createdAt");

-- CreateIndex
CREATE INDEX "security_audit_logs_ipAddress_action_createdAt_idx" ON "public"."security_audit_logs"("ipAddress", "action", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."security_audit_logs" ADD CONSTRAINT "security_audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
