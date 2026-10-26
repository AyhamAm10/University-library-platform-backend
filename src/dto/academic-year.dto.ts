import * as yup from "yup";

export const CreateAcademicYearSchema = yup.object({
  branchId: yup.string().optional(),
  departmentId: yup.string().nullable().optional(),
  name: yup.string().required("اسم السنة الدراسية مطلوب (مثال: السنة الأولى، السنة الخامسة)"),
  yearOrder: yup.number().integer().min(1).optional().default(1),
});

export type CreateAcademicYearDto = yup.InferType<typeof CreateAcademicYearSchema>;

export const UpdateAcademicYearSchema = yup.object({
  name: yup.string().optional(),
  yearOrder: yup.number().integer().min(1).optional(),
  isActive: yup.boolean().optional(),
});

export type UpdateAcademicYearDto = yup.InferType<typeof UpdateAcademicYearSchema>;
