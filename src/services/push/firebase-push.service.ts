import { App, cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging, Messaging } from "firebase-admin/messaging";
import { Environment } from "../../config/environment";
import { prisma } from "../../config/prisma";
import { logger } from "../../logging/logger";

export interface PushPayload {
  title: string;
  body: string;
  /** قيم نصية فقط (قيد من FCM) — تُستخدم للانتقال داخل التطبيق عند الضغط */
  data?: Record<string, string>;
}

const FCM_BATCH_SIZE = 500;
const ANDROID_CHANNEL_ID = "default";

// رموز لم تعد صالحة (تطبيق محذوف أو رمز منتهي) — تُحذف من قاعدة البيانات
const STALE_TOKEN_ERRORS = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

let messagingInstance: Messaging | null | undefined;

/**
 * يهيئ Firebase Admin مرة واحدة. إن لم تُضبط متغيرات البيئة يعيد null وتُتخطى الإشعارات الفورية.
 */
function getFirebaseMessaging(): Messaging | null {
  if (messagingInstance !== undefined) return messagingInstance;

  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = Environment;
  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    logger.warn("[Push] Firebase credentials are not configured; push notifications are disabled");
    messagingInstance = null;
    return null;
  }

  try {
    const app: App =
      getApps()[0] ??
      initializeApp({
        credential: cert({
          projectId: FIREBASE_PROJECT_ID,
          clientEmail: FIREBASE_CLIENT_EMAIL,
          privateKey: FIREBASE_PRIVATE_KEY,
        }),
      });
    messagingInstance = getMessaging(app);
  } catch (error) {
    logger.error(`[Push] Failed to initialize Firebase Admin: ${(error as Error).message}`);
    messagingInstance = null;
  }

  return messagingInstance;
}

export class FirebasePushService {
  static isEnabled(): boolean {
    return getFirebaseMessaging() !== null;
  }

  /**
   * يرسل إشعاراً فورياً لكل أجهزة الطلاب المحددين على دفعات (500 رمز لكل دفعة).
   * لا يرمي أخطاء — الإشعار محفوظ مسبقاً في صندوق الوارد.
   */
  static async sendToStudents(studentIds: string[], payload: PushPayload): Promise<void> {
    const messaging = getFirebaseMessaging();
    if (!messaging || studentIds.length === 0) return;

    const tokens = await prisma.studentPushToken.findMany({
      where: { studentId: { in: studentIds } },
      select: { token: true, platform: true },
    });
    if (tokens.length === 0) return;

    const staleTokens: string[] = [];
    let delivered = 0;

    for (let i = 0; i < tokens.length; i += FCM_BATCH_SIZE) {
      const batch = tokens.slice(i, i + FCM_BATCH_SIZE).map((t) => t.token);

      try {
        const response = await messaging.sendEachForMulticast({
          tokens: batch,
          notification: { title: payload.title, body: payload.body },
          data: payload.data,
          android: {
            priority: "high",
            notification: { channelId: ANDROID_CHANNEL_ID, sound: "default", color: "#7c3aed" },
          },
          apns: { payload: { aps: { sound: "default", badge: 1 } } },
          webpush: {
            notification: { icon: "/icon-192.png", badge: "/favicon-96.png", dir: "rtl", lang: "ar" },
            fcmOptions: { link: "/" },
          },
        });

        delivered += response.successCount;
        response.responses.forEach((result, index) => {
          if (!result.success && result.error && STALE_TOKEN_ERRORS.has(result.error.code)) {
            staleTokens.push(batch[index]);
          }
        });
      } catch (error) {
        logger.error(`[Push] FCM batch failed: ${(error as Error).message}`);
      }
    }

    if (staleTokens.length > 0) {
      await prisma.studentPushToken.deleteMany({ where: { token: { in: staleTokens } } });
    }

    logger.info(`[Push] Delivered ${delivered}/${tokens.length} (removed ${staleTokens.length} stale tokens)`);
  }
}
