/*
  Warnings:

  - A unique constraint covering the columns `[classCode]` on the table `classes` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `classCode` to the `classes` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "classes" ADD COLUMN     "classCode" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "classes_classCode_key" ON "classes"("classCode");
