// يجب تحميل إعدادات Yup العربية قبل أي مخطط DTO
import "./common/errors/validator";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import qs from "qs";
import { Environment } from "./config/environment";
import { logger } from "./logging/logger";
import { mainRouter } from "./routes";
import { errorHandler, notFoundHandler } from "./common/errors/error.handler";
import { prisma } from "./config/prisma";
import { bootstrapSuperAdmin } from "./config/bootstrap";
import { globalRateLimiter } from "./middlewares/rate-limit.middleware";

import path from "path";

Environment.assertProductionReady();

const app = express();

// الخادم يعمل خلف بروكسي (Cloudflare Tunnel / Nginx) — ضروري لقراءة IP الحقيقي في الـ Rate Limit
app.set("trust proxy", Environment.TRUST_PROXY);
app.disable("x-powered-by");

app.use(
  helmet({
    // عارض PDF يعمل داخل WebView ويحمّل ملفات /static من أصل مختلف
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    origin: ["*"],
    // origin: Environment.CORS_ORIGINS.length > 0 ? Environment.CORS_ORIGINS : true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Client-Type",
      "X-Device-Id",
      "Accept-Language",
      "X-Library-Id",
      "X-Time-Period-Id",
      "Range",
    ],
    exposedHeaders: [
      "Authorization",
      "Content-Range",
      "Accept-Ranges",
      "Content-Length",
    ],
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());
app.set("query parser", (str: string) => qs.parse(str));

// Serve static assets (such as local PDF.js bundle)
app.use("/static", express.static(path.resolve(__dirname, "../public"), { maxAge: "7d" }));

// Root healthcheck
app.get("/", (req, res) => {
  res.json({ message: "Multi-Tenant Education Library Platform API is running" });
});

// Mount main API router
app.use(Environment.BASE_URL, globalRateLimiter, mainRouter);

// Unknown routes
app.use(notFoundHandler);

// Centralized error handler
app.use(errorHandler);

const PORT = Environment.PORT;

if (process.env.NODE_ENV !== "test") {
  const server = app.listen(PORT, "0.0.0.0", async () => {
    logger.info(`Server running at http://localhost:${PORT}${Environment.BASE_URL}`);
    try {
      await prisma.$connect();
      logger.info("Prisma connected to PostgreSQL successfully");
      await bootstrapSuperAdmin();
    } catch (err) {
      logger.error("Failed to connect to database:", err);
    }
  });

  const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down gracefully`);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("unhandledRejection", (reason) => {
    logger.error(`Unhandled rejection: ${reason instanceof Error ? reason.stack : String(reason)}`);
  });
  process.on("uncaughtException", (error) => {
    logger.error(`Uncaught exception: ${error.stack}`);
    shutdown("uncaughtException");
  });
}

export { app };
