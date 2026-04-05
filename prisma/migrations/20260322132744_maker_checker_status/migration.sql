/*
  Warnings:

  - The values [INACTIVE] on the enum `PartStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [UNLOCKED] on the enum `TestStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PartStatus_new" AS ENUM ('PENDING', 'ACTIVE', 'LOCKED');
-- Map old values to new ones during conversion
ALTER TABLE "parts" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "parts" ALTER COLUMN "status" TYPE "PartStatus_new" USING (CASE WHEN "status"::text = 'INACTIVE' THEN 'LOCKED'::"PartStatus_new" ELSE "status"::text::"PartStatus_new" END);
ALTER TYPE "PartStatus" RENAME TO "PartStatus_old";
ALTER TYPE "PartStatus_new" RENAME TO "PartStatus";
DROP TYPE "PartStatus_old";
ALTER TABLE "parts" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterEnum
ALTER TYPE "QuestionStatus" ADD VALUE 'PENDING';

-- AlterEnum
BEGIN;
CREATE TYPE "TestStatus_new" AS ENUM ('PENDING', 'ACTIVE', 'LOCKED');
-- Map old values to new ones during conversion
ALTER TABLE "tests" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "tests" ALTER COLUMN "status" TYPE "TestStatus_new" USING (CASE WHEN "status"::text = 'UNLOCKED' THEN 'ACTIVE'::"TestStatus_new" ELSE "status"::text::"TestStatus_new" END);
ALTER TYPE "TestStatus" RENAME TO "TestStatus_old";
ALTER TYPE "TestStatus_new" RENAME TO "TestStatus";
DROP TYPE "TestStatus_old";
ALTER TABLE "tests" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterTable
ALTER TABLE "parts" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "questions" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "tests" ALTER COLUMN "status" SET DEFAULT 'PENDING';
