import * as yup from "yup";

export const LoginSchema = yup.object({
  phone: yup.string().optional(),
  email: yup.string().optional(),
  password: yup.string().min(6, "كلمة المرور يجب أن لا تقل عن 6 أحرف").required("كلمة المرور مطلوبة"),
}).test(
  "at-least-one-identifier",
  "رقم الهاتف مطلوب",
  (value) => Boolean(value.phone?.trim() || value.email?.trim())
);

export type LoginDto = yup.InferType<typeof LoginSchema>;

export const CreateAdminUserSchema = yup.object({
  phone: yup.string().required("رقم الهاتف مطلوب"),
  fullName: yup.string().required("الاسم الكامل مطلوب"),
  password: yup.string().min(6, "كلمة المرور يجب أن لا تقل عن 6 أحرف").required("كلمة المرور مطلوبة"),
  libraryId: yup.string().nullable().optional(),
});

export type CreateAdminUserDto = yup.InferType<typeof CreateAdminUserSchema>;
