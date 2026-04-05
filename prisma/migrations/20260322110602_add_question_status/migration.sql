-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('ACTIVE', 'LOCKED');

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "status" "QuestionStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX "questions_status_idx" ON "questions"("status");
