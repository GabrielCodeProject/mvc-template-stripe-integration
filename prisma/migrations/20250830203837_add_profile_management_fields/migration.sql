-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "lastProfileUpdate" TIMESTAMP(3),
ADD COLUMN     "location" TEXT,
ADD COLUMN     "phoneNumber" TEXT,
ADD COLUMN     "preferences" JSONB,
ADD COLUMN     "profileCompleteness" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "socialLinks" JSONB,
ADD COLUMN     "website" TEXT;

-- CreateTable
CREATE TABLE "public"."linked_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "providerEmail" TEXT,
    "displayName" TEXT,
    "profileUrl" TEXT,
    "avatarUrl" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "linked_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "linked_accounts_userId_idx" ON "public"."linked_accounts"("userId");

-- CreateIndex
CREATE INDEX "linked_accounts_provider_idx" ON "public"."linked_accounts"("provider");

-- CreateIndex
CREATE INDEX "linked_accounts_providerId_idx" ON "public"."linked_accounts"("providerId");

-- CreateIndex
CREATE INDEX "linked_accounts_isActive_idx" ON "public"."linked_accounts"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "linked_accounts_userId_provider_key" ON "public"."linked_accounts"("userId", "provider");

-- CreateIndex
CREATE INDEX "users_lastProfileUpdate_idx" ON "public"."users"("lastProfileUpdate");

-- CreateIndex
CREATE INDEX "users_profileCompleteness_idx" ON "public"."users"("profileCompleteness");

-- AddForeignKey
ALTER TABLE "public"."linked_accounts" ADD CONSTRAINT "linked_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
