import * as yup from "yup";

export const CreateSubjectSchema = yup.object({
  name: yup.string().required("اسم المادة الدراسية مطلوب"),
  code: yup.string().optional().nullable(),
  description: yup.string().optional().nullable(),
  branchId: yup.string().optional().nullable(),
  departmentId: yup.string().optional().nullable(),
  academicYearId: yup.string().required("السنة الدراسية مطلوبة"),
  yearLevel: yup.number().integer().optional().nullable(),
}).test(
  "branch-or-dept",
  "يجب تحديد الفرع الأكاديمي أو القسم التابعة له المادة",
  (value) => Boolean(value?.branchId || value?.departmentId)
);

export type CreateSubjectDto = yup.InferType<typeof CreateSubjectSchema>;

export const UpdateSubjectSchema = yup.object({
  name: yup.string().optional(),
  code: yup.string().optional().nullable(),
  description: yup.string().optional().nullable(),
  isActive: yup.boolean().optional(),
  academicYearId: yup.string().optional().nullable(),
  yearLevel: yup.number().integer().min(1).optional(),
  branchId: yup.string().optional().nullable(),
});

export type UpdateSubjectDto = yup.InferType<typeof UpdateSubjectSchema>;
