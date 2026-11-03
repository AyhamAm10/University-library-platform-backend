import dotenv from "dotenv";
dotenv.config();

const DEFAULT_ACCESS_SECRET = "access_secret_default_2026";
const DEFAULT_REFRESH_SECRET = "refresh_secret_default_2026";

export const Environment = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: Number(process.env.PORT || 4000),
  BASE_URL: process.env.BASE_URL || "/api",
  DATABASE_URL: process.env.DATABASE_URL || "",
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || DEFAULT_ACCESS_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || DEFAULT_REFRESH_SECRET,
  SUPER_ADMIN_PHONE: process.env.SUPER_ADMIN_PHONE || "",
  SUPER_ADMIN_PASSWORD: process.env.SUPER_ADMIN_PASSWORD || "",
  // قائمة الأصول المسموحة للوحة التحكم مفصولة بفواصل، فارغة = السماح لأي أصل
  CORS_ORIGINS: (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  // عدد البروكسيات أمام الخادم (Cloudflare Tunnel = 1)
  TRUST_PROXY: Number(process.env.TRUST_PROXY ?? 1),

  isDevelopment(): boolean {
    return this.NODE_ENV === "development";
  },
  isProduction(): boolean {
    return this.NODE_ENV === "production";
  },

  /**
   * يمنع تشغيل الخادم في بيئة الإنتاج بمفاتيح JWT الافتراضية أو بدون قاعدة بيانات.
   */
  assertProductionReady(): void {
    if (!this.isProduction()) return;

    const problems: string[] = [];
    if (!this.DATABASE_URL) problems.push("DATABASE_URL is missing");
    if (this.JWT_ACCESS_SECRET === DEFAULT_ACCESS_SECRET || this.JWT_ACCESS_SECRET.length < 32) {
      problems.push("JWT_ACCESS_SECRET must be set to a random value of at least 32 characters");
    }
    if (this.JWT_REFRESH_SECRET === DEFAULT_REFRESH_SECRET || this.JWT_REFRESH_SECRET.length < 32) {
      problems.push("JWT_REFRESH_SECRET must be set to a random value of at least 32 characters");
    }
    if (this.JWT_ACCESS_SECRET === this.JWT_REFRESH_SECRET) {
      problems.push("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different");
    }

    if (problems.length > 0) {
      throw new Error(`Unsafe production configuration:\n- ${problems.join("\n- ")}`);
    }
  },
};
