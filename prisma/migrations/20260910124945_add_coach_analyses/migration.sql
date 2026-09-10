-- CreateTable
CREATE TABLE "coach_analyses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "lens" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "analysis" JSONB NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coach_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "coach_analyses_user_id_lens_year_month_key" ON "coach_analyses"("user_id", "lens", "year", "month");

-- AddForeignKey
ALTER TABLE "coach_analyses" ADD CONSTRAINT "coach_analyses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
