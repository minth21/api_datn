-- CreateEnum
CREATE TYPE "FlashcardStatus" AS ENUM ('NEW', 'LEARNING', 'MASTERED');

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "analysis" TEXT,
ADD COLUMN     "evidence" TEXT;

-- CreateTable
CREATE TABLE "flashcards" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "ipa" TEXT,
    "exampleEn" TEXT,
    "exampleVi" TEXT,
    "status" "FlashcardStatus" NOT NULL DEFAULT 'NEW',
    "lastReviewedAt" TIMESTAMP(3),
    "nextReviewAt" TIMESTAMP(3),
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "partId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flashcards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "flashcards_userId_idx" ON "flashcards"("userId");

-- CreateIndex
CREATE INDEX "flashcards_status_idx" ON "flashcards"("status");

-- AddForeignKey
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_partId_fkey" FOREIGN KEY ("partId") REFERENCES "parts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
