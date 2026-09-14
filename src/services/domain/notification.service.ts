import { TenantService } from "../tenant.service";
import { Notification } from "@prisma/client";
import { TenantContext } from "../../types/tenant.context";

export class NotificationService extends TenantService<Notification> {
  constructor(tenantContext: TenantContext) {
    super("notification", "notification", tenantContext, false);
  }
}
