import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma";
import { ForbiddenError, NotFoundError } from "../common/errors/http.error";
import { UserRole, PeriodStatus } from "@prisma/client";

export const tenantMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user;
    if (!user) {
      return next(new ForbiddenError("Authentication required for tenant context"));
    }

    let libraryId: string = "";
    let timePeriodId: string | undefined = undefined;

    if (user.role === UserRole.LIBRARY_ADMIN) {
      if (!user.libraryId) {
        return next(new ForbiddenError("Library Admin account is not linked to any library"));
      }
      libraryId = user.libraryId;

      // Check if explicit time period requested (e.g. historical review)
      const requestedPeriodId = (req.query.timePeriodId as string) || (req.headers["x-time-period-id"] as string);
      if (requestedPeriodId) {
        const period = await prisma.timePeriod.findFirst({
          where: {
            id: requestedPeriodId,
            libraryId,
          },
        });
        if (!period) {
          return next(new NotFoundError("Requested time period not found in this library"));
        }
        timePeriodId = period.id;
      } else {
        // Default to current ACTIVE period
        const activePeriod = await prisma.timePeriod.findFirst({
          where: {
            libraryId,
            status: PeriodStatus.ACTIVE,
          },
        });
        if (activePeriod) {
          timePeriodId = activePeriod.id;
        }
      }

      req.tenant = {
        libraryId,
        timePeriodId,
        userId: user.id,
        role: user.role,
        isSuperAdmin: false,
      };
      return next();
    }

    if (user.role === UserRole.SUPER_ADMIN) {
      const explicitLibraryId = (req.query.libraryId as string) || (req.headers["x-library-id"] as string);
      if (explicitLibraryId) {
        const library = await prisma.library.findUnique({
          where: { id: explicitLibraryId },
        });
        if (!library) {
          return next(new NotFoundError("Target library not found"));
        }
        libraryId = library.id;

        const requestedPeriodId = (req.query.timePeriodId as string) || (req.headers["x-time-period-id"] as string);
        if (requestedPeriodId) {
          const period = await prisma.timePeriod.findFirst({
            where: { id: requestedPeriodId, libraryId },
          });
          if (period) timePeriodId = period.id;
        } else {
          const activePeriod = await prisma.timePeriod.findFirst({
            where: { libraryId, status: PeriodStatus.ACTIVE },
          });
          if (activePeriod) timePeriodId = activePeriod.id;
        }
      }

      req.tenant = {
        libraryId,
        timePeriodId,
        userId: user.id,
        role: user.role,
        isSuperAdmin: true,
      };
      return next();
    }

    if (user.role === "STUDENT") {
      if (!user.libraryId) {
        return next(new ForbiddenError("Student is not linked to any library"));
      }
      libraryId = user.libraryId;

      const activePeriod = await prisma.timePeriod.findFirst({
        where: { libraryId, status: PeriodStatus.ACTIVE },
      });
      if (activePeriod) {
        timePeriodId = activePeriod.id;
      }

      req.tenant = {
        libraryId,
        timePeriodId,
        userId: user.id,
        role: user.role,
        isSuperAdmin: false,
      };
      return next();
    }

    return next(new ForbiddenError("Unauthorized role for tenant operations"));
  } catch (error) {
    next(error);
  }
};
