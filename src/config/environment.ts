import dotenv from "dotenv";
dotenv.config();

export const Environment = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: Number(process.env.PORT || 4000),
  BASE_URL: process.env.BASE_URL || "/api",
  DATABASE_URL: process.env.DATABASE_URL || "",
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || "access_secret_default_2026",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "refresh_secret_default_2026",
  SUPER_ADMIN_PHONE: process.env.SUPER_ADMIN_PHONE || "",
  SUPER_ADMIN_PASSWORD: process.env.SUPER_ADMIN_PASSWORD || "",

  isDevelopment(): boolean {
    return this.NODE_ENV === "development";
  },
  isProduction(): boolean {
    return this.NODE_ENV === "production";
  },
};
