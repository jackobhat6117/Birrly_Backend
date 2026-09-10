-- AlterTable
ALTER TABLE "ai_interactions" ADD COLUMN     "corrected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "final_command" JSONB,
ADD COLUMN     "input_text" TEXT,
ADD COLUMN     "language" TEXT,
ADD COLUMN     "outcome" TEXT,
ADD COLUMN     "predicted_command" JSONB;

-- CreateIndex
CREATE INDEX "ai_interactions_outcome_corrected_idx" ON "ai_interactions"("outcome", "corrected");
