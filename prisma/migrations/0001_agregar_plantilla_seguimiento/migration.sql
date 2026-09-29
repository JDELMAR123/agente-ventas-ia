-- AlterEnum
ALTER TYPE "FollowUpStatus" ADD VALUE 'FALLIDO';

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "waFollowUpTemplateLang" TEXT NOT NULL DEFAULT 'es',
ADD COLUMN     "waFollowUpTemplateName" TEXT;

