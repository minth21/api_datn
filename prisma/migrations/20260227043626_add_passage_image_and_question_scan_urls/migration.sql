-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "passageImageUrl" TEXT,
ADD COLUMN     "questionScanUrl" TEXT;

-- AlterTable
ALTER TABLE "user_part_progress" ADD COLUMN     "userAnswers" TEXT;
