-- CreateTable
CREATE TABLE "subscription_archives" (
    "id" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL,
    "timePeriodId" TEXT NOT NULL,
    "timePeriodName" TEXT NOT NULL,
    "originalSubscriptionId" TEXT NOT NULL,
    "studentId" TEXT,
    "studentName" TEXT NOT NULL,
    "studentPhone" TEXT,
    "subjectId" TEXT,
    "subjectName" TEXT NOT NULL,
    "featureType" "FeatureType" NOT NULL,
    "materialId" TEXT,
    "materialTitle" TEXT,
    "status" "SubscriptionStatus" NOT NULL,
    "isFreeTrial" BOOLEAN NOT NULL DEFAULT false,
    "subscribedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_archives_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subscription_archives_libraryId_timePeriodId_idx" ON "subscription_archives"("libraryId", "timePeriodId");
CREATE INDEX "subscription_archives_libraryId_studentId_idx" ON "subscription_archives"("libraryId", "studentId");
CREATE INDEX "subscription_archives_libraryId_archivedAt_idx" ON "subscription_archives"("libraryId", "archivedAt");

-- AddForeignKey
ALTER TABLE "subscription_archives" ADD CONSTRAINT "subscription_archives_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "libraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
