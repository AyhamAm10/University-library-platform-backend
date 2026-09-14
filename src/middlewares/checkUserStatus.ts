import { Request, Response, NextFunction } from "express";
import { ForbiddenError, UnauthorizedError } from "../common/errors/http.error";

export const checkUserStatus = (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(new UnauthorizedError("Authentication required"));
    }
    next();
  } catch (error) {
    next(error);
  }
};
