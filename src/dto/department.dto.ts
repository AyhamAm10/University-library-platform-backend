import * as yup from "yup";

export const CreateDepartmentSchema = yup.object({
  branchId: yup.string().required("الفرع التابع له القسم مطلوب"),
  name: yup.string().required("اسم القسم مطلوب"),
  code: yup.string().optional().nullable(),
});

export type CreateDepartmentDto = yup.InferType<typeof CreateDepartmentSchema>;

export const UpdateDepartmentSchema = yup.object({
  name: yup.string().optional(),
  code: yup.string().optional().nullable(),
  isActive: yup.boolean().optional(),
});

export type UpdateDepartmentDto = yup.InferType<typeof UpdateDepartmentSchema>;
