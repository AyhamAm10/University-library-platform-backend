import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import qs from "qs";
import { Environment } from "./config/environment";
import { logger } from "./logging/logger";
import { mainRouter } from "./routes";
import { errorHandler } from "./common/errors/error.handler";
import { prisma } from "./config/prisma";

import path from "path";

const app = express();

app.use(
  cors({
    origin: true,
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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.set("query parser", (str: string) => qs.parse(str));

// Serve static assets (such as local PDF.js bundle)
app.use("/static", express.static(path.resolve(process.cwd(), "public")));

// Root healthcheck
app.get("/", (req, res) => {
  res.json({ message: "Multi-Tenant Education Library Platform API is running" });
});

// Mount main API router
app.use(Environment.BASE_URL, mainRouter);

// Centralized error handler
app.use(errorHandler);

const PORT = Environment.PORT;

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, "0.0.0.0", async () => {
    logger.info(`Server running at http://localhost:${PORT}${Environment.BASE_URL}`);
    try {
      await prisma.$connect();
      logger.info("Prisma connected to PostgreSQL successfully");
    } catch (err) {
      logger.error("Failed to connect to database:", err);
    }
  });
}

export { app };
