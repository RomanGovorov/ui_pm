-- AlterEnum: Add 'admin' to UserRole enum
ALTER TYPE "UserRole" ADD VALUE 'admin';

-- AlterTable: Add email and passwordHash to users table
ALTER TABLE "users" ADD COLUMN "email" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN "password_hash" VARCHAR(255);

-- CreateIndex: Unique index on email
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
