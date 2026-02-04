/*
  Warnings:

  - The values [DRAFT,PUBLISHED,ARCHIVED] on the enum `TestStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `description` on the `tests` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "TestStatus_new" AS ENUM ('LOCKED', 'UNLOCKED');
ALTER TABLE "tests" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "tests" ALTER COLUMN "status" TYPE "TestStatus_new" USING ("status"::text::"TestStatus_new");
ALTER TYPE "TestStatus" RENAME TO "TestStatus_old";
ALTER TYPE "TestStatus_new" RENAME TO "TestStatus";
DROP TYPE "TestStatus_old";
ALTER TABLE "tests" ALTER COLUMN "status" SET DEFAULT 'LOCKED';
COMMIT;

-- AlterTable
ALTER TABLE "tests" DROP COLUMN "description",
ALTER COLUMN "status" SET DEFAULT 'LOCKED';
