import * as yup from "yup";

export const CreateStudentSchema = yup.object({
  fullName: yup.string().required("اسم الطالب الرباعي مطلوب"),
  dateOfBirth: yup.string().required("تاريخ الميلاد مطلوب"),
  phone: yup.string().required("رقم الهاتف مطلوب"),
  branchId: yup.string().optional().nullable(),
  departmentId: yup.string().optional().nullable(),
  password: yup.string().min(6, "كلمة المرور يجب أن لا تقل عن 6 خانات").optional(),
});

export type CreateStudentDto = yup.InferType<typeof CreateStudentSchema>;

export const UpdateStudentSchema = yup.object({
  fullName: yup.string().optional(),
  dateOfBirth: yup.string().optional(),
  phone: yup.string().optional(),
  branchId: yup.string().optional(),
  departmentId: yup.string().optional().nullable(),
  isActive: yup.boolean().optional(),
});

export type UpdateStudentDto = yup.InferType<typeof UpdateStudentSchema>;
