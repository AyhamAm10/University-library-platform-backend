import { TenantService } from "../tenant.service";
import { StudentPushToken } from "@prisma/client";
import { TenantContext } from "../../types/tenant.context";
import { prisma } from "../../config/prisma";

/**
 * تسجيل رموز FCM لأجهزة الطالب. الرمز فريد عالمياً، فإن انتقل الجهاز لحساب آخر يُنقل الرمز معه.
 */
export class PushTokenService extends TenantService<StudentPushToken> {
  constructor(tenantContext: TenantContext) {
    super("studentPushToken", "studentPushToken", tenantContext, false);
  }

  async register(studentId: string, dto: { token: string; platform: string; deviceId?: string | null }) {
    // upsert مباشر لأن الرمز قد يكون مسجلاً سابقاً لطالب أو مكتبة أخرى على نفس الجهاز
    return await prisma.studentPushToken.upsert({
      where: { token: dto.token },
      create: {
        studentId,
        libraryId: this.libraryId,
        token: dto.token,
        platform: dto.platform,
        deviceId: dto.deviceId ?? null,
      },
      update: {
        studentId,
        libraryId: this.libraryId,
        platform: dto.platform,
        deviceId: dto.deviceId ?? null,
      },
    });
  }

  async unregister(studentId: string, token: string) {
    return await this.deleteMany({ studentId, token });
  }
}
