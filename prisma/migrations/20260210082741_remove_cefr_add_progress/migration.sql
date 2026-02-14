/*
  Warnings:

  - You are about to drop the column `cefrLevel` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "parts" ADD COLUMN     "instructionImgUrl" TEXT;

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "audioUrl" TEXT,
ADD COLUMN     "transcript" TEXT;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "cefrLevel",
ADD COLUMN     "progress" INTEGER NOT NULL DEFAULT 0;

-- DropEnum
DROP TYPE "CEFRLevel";
