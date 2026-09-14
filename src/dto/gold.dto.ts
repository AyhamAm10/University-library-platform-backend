import * as yup from "yup";

export const CreateGoldMaterialSchema = yup.object({
  subjectId: yup.string().required("المادة الدراسية مطلوبة"),
  title: yup.string().required("عنوان الورقة الذهبية مطلوب"),
  description: yup.string().optional().nullable(),
  fileUrl: yup.string().url("رابط الملف غير صالح").optional().nullable(),
});

export type CreateGoldMaterialDto = yup.InferType<typeof CreateGoldMaterialSchema>;

export const UpdateGoldMaterialSchema = yup.object({
  title: yup.string().optional(),
  description: yup.string().optional().nullable(),
  fileUrl: yup.string().url().optional().nullable(),
});

export type UpdateGoldMaterialDto = yup.InferType<typeof UpdateGoldMaterialSchema>;
