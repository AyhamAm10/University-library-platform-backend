/**
 * تشخيص الإشعارات الفورية لطالب واحد — لا يرسل أي إشعار حقيقي.
 * الاستخدام على السيرفر:  npx tsx src/scripts/push-diagnose.ts 0900000004
 *
 * يتحقق من: إعداد Firebase، وجود الطالب، رموز أجهزته المسجلة،
 * وصلاحية كل رمز لدى Firebase (dry run).
 */
import { cert, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { Environment } from "../config/environment";
import { prisma } from "../config/prisma";

async function main() {
  const phone = process.argv[2];
  if (!phone) {
    console.log("Usage: npx tsx src/scripts/push-diagnose.ts <student-phone>");
    return;
  }

  const configured = Boolean(
    Environment.FIREBASE_PROJECT_ID && Environment.FIREBASE_CLIENT_EMAIL && Environment.FIREBASE_PRIVATE_KEY
  );
  console.log(`1) Firebase env configured: ${configured ? "YES" : "NO  <-- add FIREBASE_* to .env and restart"}`);

  const student = await prisma.student.findUnique({
    where: { phone },
    select: { id: true, fullName: true, isActive: true, pushTokens: { select: { token: true, platform: true, updatedAt: true } } },
  });
  if (!student) {
    console.log("2) Student: NOT FOUND");
    return;
  }
  console.log(`2) Student: ${student.fullName} (active: ${student.isActive})`);

  const inbox = await prisma.notificationRecipient.count({ where: { studentId: student.id } });
  console.log(`3) Notifications in inbox: ${inbox}`);

  console.log(`4) Registered devices: ${student.pushTokens.length}`);
  if (student.pushTokens.length === 0) {
    console.log(
      "   <-- the phone never registered. Install the NEW build (1.0.6+), log in, allow notifications, then reopen the app."
    );
    return;
  }
  student.pushTokens.forEach((t) =>
    console.log(`   - ${t.platform}, updated ${t.updatedAt.toISOString()}, token ...${t.token.slice(-8)}`)
  );

  if (!configured) return;

  const app = initializeApp({
    credential: cert({
      projectId: Environment.FIREBASE_PROJECT_ID,
      clientEmail: Environment.FIREBASE_CLIENT_EMAIL,
      privateKey: Environment.FIREBASE_PRIVATE_KEY,
    }),
  });
  const result = await getMessaging(app).sendEachForMulticast(
    {
      tokens: student.pushTokens.map((t) => t.token),
      notification: { title: "diagnose", body: "dry run" },
    },
    true // dryRun: Firebase validates without delivering
  );
  result.responses.forEach((r, i) =>
    console.log(`5) Token ...${student.pushTokens[i].token.slice(-8)}: ${r.success ? "VALID" : `INVALID (${r.error?.code})`}`)
  );
}

main()
  .catch((error) => console.error("Diagnose failed:", error.message))
  .finally(() => prisma.$disconnect());
