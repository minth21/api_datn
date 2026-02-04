/*
  Warnings:

  - Added the required column `orderIndex` to the `parts` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PartStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "parts" ADD COLUMN     "orderIndex" INTEGER NOT NULL,
ADD COLUMN     "status" "PartStatus" NOT NULL DEFAULT 'ACTIVE';
