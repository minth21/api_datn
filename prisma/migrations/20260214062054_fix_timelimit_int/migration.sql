/*
  Warnings:

  - The `timeLimit` column on the `parts` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "parts" DROP COLUMN "timeLimit",
ADD COLUMN     "timeLimit" INTEGER;
