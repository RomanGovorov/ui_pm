-- AlterEnum
ALTER TYPE "TaskStatus" ADD VALUE 'backlog';

-- AlterTable
ALTER TABLE "tasks" ALTER COLUMN "status" SET DEFAULT 'backlog';
