/*
  Warnings:

  - You are about to drop the column `toeicLevel` on the `users` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "CEFRLevel" AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1');

-- AlterTable
ALTER TABLE "users" DROP COLUMN "toeicLevel",
ADD COLUMN     "cefrLevel" "CEFRLevel";
