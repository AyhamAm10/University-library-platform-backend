import { TenantContext } from "./tenant.context";
import { UserRole } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string | null;
        phone?: string | null;
        fullName: string;
        role: UserRole | "STUDENT";
        libraryId?: string | null;
      };
      student?: any;
      tenant?: TenantContext;
      lang?: "ar" | "en";
    }
  }
}
