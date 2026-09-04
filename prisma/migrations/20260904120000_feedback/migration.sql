-- CreateEnum
CREATE TYPE "feedback_category" AS ENUM ('BUG', 'IDEA', 'OTHER');

-- CreateEnum
CREATE TYPE "feedback_source" AS ENUM ('APP', 'BOT');

-- CreateTable
CREATE TABLE "feedback" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "category" "feedback_category" NOT NULL DEFAULT 'OTHER',
    "message" TEXT NOT NULL,
    "source" "feedback_source" NOT NULL,
    "page_context" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feedback_user_id_created_at_idx" ON "feedback"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "feedback_created_at_idx" ON "feedback"("created_at");

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
