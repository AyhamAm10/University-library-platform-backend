import { NextFunction, Request, Response } from "express";
import { logger } from "../../logging/logger";
import { APIError, HttpStatusCode } from "./api.error";
import { HttpError } from "./http.error";

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error(`[${req.method}] ${req.url} - ${error.message}`);
  if (error.stack) {
    logger.error(error.stack);
  }

  if (error instanceof APIError) {
    return res.status(error.httpCode).json({
      success: false,
      code: error.code,
      message: error.message,
      description: error.description,
      error: error.name,
    });
  }

  if (error instanceof HttpError) {
    return res.status(error.statusCode).json({
      success: false,
      status: error.statusCode,
      message: error.message,
      error: error.name,
      details: error.details,
    });
  }

  return res.status(HttpStatusCode.INTERNAL_SERVER).json({
    success: false,
    message: "Internal server error",
    error: process.env.NODE_ENV === "production" ? "Server Error" : error.message,
  });
};
