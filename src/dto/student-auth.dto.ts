import * as yup from "yup";

export const StudentRegisterSchema = yup.object({
  libraryId: yup.string().required("يجب اختيار المكتبة أو المعهد"),
  branchId: yup.string().optional().nullable(),
  departmentId: yup.string().optional().nullable(),
  fullName: yup.string().required("اسم الطالب الرباعي مطلوب"),
  dateOfBirth: yup.string().required("تاريخ الميلاد مطلوب"),
  phone: yup.string().required("رقم الهاتف مطلوب"),
  password: yup.string().min(6, "كلمة المرور يجب أن لا تقل عن 6 خانات").required("كلمة المرور مطلوبة"),
});

export type StudentRegisterDto = yup.InferType<typeof StudentRegisterSchema>;

export const StudentLoginSchema = yup.object({
  phone: yup.string().required("رقم الهاتف مطلوب"),
  password: yup.string().required("كلمة المرور مطلوبة"),
  deviceId: yup.string().required("معرف الجهاز مطلوب للتحقق الأمني"),
});

export type StudentLoginDto = yup.InferType<typeof StudentLoginSchema>;

export const StudentActivateSchema = yup.object({
  phone: yup.string().required("رقم الهاتف مطلوب"),
  activationCode: yup.string().required("رمز التفعيل مطلوب"),
  deviceId: yup.string().required("معرف الجهاز مطلوب لربط الحساب"),
});

export type StudentActivateDto = yup.InferType<typeof StudentActivateSchema>;

export const StudentRefreshSchema = yup.object({
  refreshToken: yup.string().required("رمز التحديث مطلوب"),
  deviceId: yup.string().required("معرف الجهاز مطلوب للتحقق الأمني"),
});

export type StudentRefreshDto = yup.InferType<typeof StudentRefreshSchema>;
