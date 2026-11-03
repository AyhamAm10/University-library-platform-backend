-- إعادة هيكلة الإشعارات: إشعار واحد + صندوق وارد لكل طالب + رموز FCM.
-- الإشعارات القديمة (سطر لكل طالب) تُنقل إلى notification_recipients قبل حذف الأعمدة القديمة.

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('NEW_CONTENT', 'ANNOUNCEMENT', 'SUBSCRIPTION', 'COMPLAINT', 'SYSTEM');

-- 1. New columns on notifications
ALTER TABLE "notifications"
ADD COLUMN     "audience" JSONB,
ADD COLUMN     "category" "NotificationCategory" NOT NULL DEFAULT 'SYSTEM',
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "data" JSONB,
ADD COLUMN     "recipientsCount" INTEGER NOT NULL DEFAULT 0;

-- 2. Recipients table
CREATE TABLE "notification_recipients" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_recipients_pkey" PRIMARY KEY ("id")
);

-- 3. Preserve existing per-student notifications as recipients
INSERT INTO "notification_recipients" ("id", "notificationId", "studentId", "libraryId", "readAt", "createdAt")
SELECT gen_random_uuid()::text, n."id", n."studentId", n."libraryId",
       CASE WHEN n."isRead" THEN n."createdAt" ELSE NULL END,
       n."createdAt"
FROM "notifications" n
WHERE n."studentId" IS NOT NULL;

UPDATE "notifications"
SET "category" = CASE "type"
        WHEN 'LECTURE_UPLOAD' THEN 'NEW_CONTENT'::"NotificationCategory"
        WHEN 'COMPLAINT' THEN 'COMPLAINT'::"NotificationCategory"
        WHEN 'SUBSCRIPTION_APPROVED' THEN 'SUBSCRIPTION'::"NotificationCategory"
        WHEN 'FREE_TRIAL_ACTIVATED' THEN 'SUBSCRIPTION'::"NotificationCategory"
        ELSE 'SYSTEM'::"NotificationCategory"
    END,
    "recipientsCount" = CASE WHEN "studentId" IS NOT NULL THEN 1 ELSE 0 END;

-- 4. Drop the old per-student columns
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_studentId_fkey";
DROP INDEX "notifications_libraryId_studentId_idx";
ALTER TABLE "notifications" DROP COLUMN "isRead",
DROP COLUMN "studentId",
DROP COLUMN "type";

-- 5. Push tokens
CREATE TABLE "student_push_tokens" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "deviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_recipients_studentId_createdAt_idx" ON "notification_recipients"("studentId", "createdAt");
CREATE INDEX "notification_recipients_studentId_readAt_idx" ON "notification_recipients"("studentId", "readAt");
CREATE UNIQUE INDEX "notification_recipients_notificationId_studentId_key" ON "notification_recipients"("notificationId", "studentId");
CREATE UNIQUE INDEX "student_push_tokens_token_key" ON "student_push_tokens"("token");
CREATE INDEX "student_push_tokens_studentId_idx" ON "student_push_tokens"("studentId");
CREATE INDEX "notifications_libraryId_createdAt_idx" ON "notifications"("libraryId", "createdAt");

-- AddForeignKey
ALTER TABLE "notification_recipients" ADD CONSTRAINT "notification_recipients_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_recipients" ADD CONSTRAINT "notification_recipients_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_push_tokens" ADD CONSTRAINT "student_push_tokens_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
