import * as yup from "yup";

export const CreateLibrarySchema = yup.object({
  name: yup.string().required("اسم المكتبة مطلوب"),
  code: yup.string().required("رمز المكتبة المعرف مطلوب"),
  phone: yup.string().optional().nullable(),
  address: yup.string().optional().nullable(),
  logoUrl: yup.string().url("رابط الشعار غير صالح").optional().nullable(),
  primaryColor: yup.string().optional().default("#1a73e8"),
  secondaryColor: yup.string().optional().default("#34a853"),
  adminFullName: yup.string().optional(),
  adminName: yup.string().optional(),
  adminPhone: yup.string().optional(),
  adminPassword: yup.string().optional(),
  admin: yup
    .object({
      fullName: yup.string().optional(),
      name: yup.string().optional(),
      phone: yup.string().optional(),
      password: yup.string().optional(),
    })
    .optional(),
  initialPeriodName: yup.string().optional(),
  initialPeriodStartDate: yup.string().optional(),
  initialPeriod: yup
    .object({
      name: yup.string().optional(),
      startDate: yup.string().optional(),
    })
    .optional(),
});

export type CreateLibraryDto = yup.InferType<typeof CreateLibrarySchema>;

export const UpdateLibrarySchema = yup.object({
  name: yup.string().optional(),
  phone: yup.string().optional().nullable(),
  address: yup.string().optional().nullable(),
  logoUrl: yup.string().url().optional().nullable(),
  primaryColor: yup.string().optional(),
  secondaryColor: yup.string().optional(),
  isActive: yup.boolean().optional(),
});

export type UpdateLibraryDto = yup.InferType<typeof UpdateLibrarySchema>;
