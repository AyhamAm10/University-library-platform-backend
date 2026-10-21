import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { prisma } from "./prisma";
import { Environment } from "./environment";
import { logger } from "../logging/logger";

/**
 * دالة التهيئة الأولية للمشرف العام (Super Admin):
 * تقرأ SUPER_ADMIN_PHONE و SUPER_ADMIN_PASSWORD من متغيرات البيئة.
 * في حال عدم وجود أحدهما أو كليهما، لا تقوم بأي إجراء.
 */
export async function bootstrapSuperAdmin(): Promise<void> {
  const phone = Environment.SUPER_ADMIN_PHONE?.trim();
  const password = Environment.SUPER_ADMIN_PASSWORD?.trim();

  // في حال عدم توفر رقم الهاتف أو كلمة المرور، لا تقم بأي إجراء
  if (!phone || !password) {
    return;
  }

  try {
    const existingUser = await prisma.user.findFirst({
      where: { phone },
    });

    if (!existingUser) {
      const passwordHash = await bcrypt.hash(password, 10);
      await prisma.user.create({
        data: {
          phone,
          fullName: "ayham ashram",
          passwordHash,
          role: UserRole.SUPER_ADMIN,
          isActive: true,
          libraryId: null,
        },
      });
      logger.info(`[Bootstrap] Super Admin created successfully with phone: ${phone}`);
      return;
    }

    const isPasswordMatch = await bcrypt.compare(password, existingUser.passwordHash);
    const shouldUpdateRole = existingUser.role !== UserRole.SUPER_ADMIN;
    const shouldUpdateActive = !existingUser.isActive;

    if (!isPasswordMatch || shouldUpdateRole || shouldUpdateActive) {
      const passwordHash = isPasswordMatch
        ? existingUser.passwordHash
        : await bcrypt.hash(password, 10);

      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          role: UserRole.SUPER_ADMIN,
          passwordHash,
          isActive: true,
        },
      });
      logger.info(`[Bootstrap] Super Admin updated successfully for phone: ${phone}`);
    } else {
      logger.info(`[Bootstrap] Super Admin already initialized for phone: ${phone}`);
    }
  } catch (error) {
    logger.error("[Bootstrap] Error while initializing Super Admin:", error);
  }
}
