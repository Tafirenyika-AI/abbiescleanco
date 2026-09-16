-- AlterTable
ALTER TABLE "admin_users" ADD COLUMN     "resetToken" TEXT,
ADD COLUMN     "resetTokenExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_resetToken_key" ON "admin_users"("resetToken");
