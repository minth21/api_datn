/*
  Warnings:

  - Added the required column `duration` to the `tests` table without a default value. This is not possible if the table is not empty.
  - Added the required column `testType` to the `tests` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalQuestions` to the `tests` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TestType" AS ENUM ('LISTENING', 'READING');

-- AlterTable
ALTER TABLE "tests" ADD COLUMN     "duration" INTEGER NOT NULL,
ADD COLUMN     "testType" "TestType" NOT NULL,
ADD COLUMN     "totalQuestions" INTEGER NOT NULL;
