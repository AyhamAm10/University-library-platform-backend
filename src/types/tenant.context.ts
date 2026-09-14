import { UserRole } from "@prisma/client";

export interface TenantContext {
  libraryId: string;
  timePeriodId?: string;
  userId?: string;
  role?: UserRole | "STUDENT";
  isSuperAdmin?: boolean;
}
