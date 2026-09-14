import * as yup from "yup";

export const CreateBranchSchema = yup.object({
  name: yup.string().required("اسم الفرع مطلوب"),
  code: yup.string().optional().nullable(),
  hasDepartments: yup.boolean().default(false),
});

export type CreateBranchDto = yup.InferType<typeof CreateBranchSchema>;

export const UpdateBranchSchema = yup.object({
  name: yup.string().optional(),
  code: yup.string().optional().nullable(),
  hasDepartments: yup.boolean().optional(),
  isActive: yup.boolean().optional(),
});

export type UpdateBranchDto = yup.InferType<typeof UpdateBranchSchema>;
