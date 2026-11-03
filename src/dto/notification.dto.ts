import * as yup from "yup";

export const CreateAnnouncementSchema = yup.object({
  title: yup.string().trim().max(120, "العنوان يجب أن لا يزيد عن 120 حرفاً").required("عنوان الإشعار مطلوب"),
  message: yup.string().trim().max(1000, "نص الإشعار يجب أن لا يزيد عن 1000 حرف").required("نص الإشعار مطلوب"),
  branchId: yup.string().optional().nullable(),
  departmentId: yup.string().optional().nullable(),
  academicYearId: yup.string().optional().nullable(),
  audienceLabel: yup.string().optional().nullable(),
});

export type CreateAnnouncementDto = yup.InferType<typeof CreateAnnouncementSchema>;

export const RegisterPushTokenSchema = yup.object({
  token: yup.string().trim().min(20, "رمز الإشعارات غير صالح").required("رمز الإشعارات مطلوب"),
  platform: yup
    .string()
    .oneOf(["android", "ios", "web"], "نوع المنصة غير صالح")
    .required("نوع المنصة مطلوب"),
  deviceId: yup.string().optional().nullable(),
});

export type RegisterPushTokenDto = yup.InferType<typeof RegisterPushTokenSchema>;

export const UnregisterPushTokenSchema = yup.object({
  token: yup.string().trim().required("رمز الإشعارات مطلوب"),
});
