import * as yup from "yup";

export const CreateSubjectSchema = yup.object({
  name: yup.string().required("اسم المادة الدراسية مطلوب"),
  code: yup.string().optional().nullable(),
  description: yup.string().optional().nullable(),
});

export type CreateSubjectDto = yup.InferType<typeof CreateSubjectSchema>;

export const UpdateSubjectSchema = yup.object({
  name: yup.string().optional(),
  code: yup.string().optional().nullable(),
  description: yup.string().optional().nullable(),
  isActive: yup.boolean().optional(),
});

export type UpdateSubjectDto = yup.InferType<typeof UpdateSubjectSchema>;
