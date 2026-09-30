import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

function initPrisma(): PrismaClient {
  const url = process.env.DATABASE_URL || "";
  const isNeon = url.includes("neon.tech");

  if (isNeon) {
    const adapter = new PrismaNeon({ connectionString: url });
    return new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = global.prismaGlobal || initPrisma();

if (process.env.NODE_ENV !== "production") {
  global.prismaGlobal = prisma;
}
