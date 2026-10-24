import * as yup from "yup";

export const CreateAppReleaseSchema = yup.object({
  version: yup
    .string()
    .trim()
    .required("رقم الإصدار مطلوب (مثل: 1.0.1)"),
  versionCode: yup
    .number()
    .transform((value, originalValue) => (originalValue === "" ? undefined : Number(originalValue)))
    .required("كود الإصدار الرقمي مطلوب (مثل: 2)")
    .positive("يجب أن يكون كود الإصدار رقماً موجباً")
    .integer("يجب أن يكون كود الإصدار رقماً صحيحاً"),
  releaseNotes: yup
    .string()
    .trim()
    .optional()
    .nullable(),
});

export type CreateAppReleaseDto = yup.InferType<typeof CreateAppReleaseSchema>;

export const CheckAppVersionSchema = yup.object({
  version: yup.string().optional().nullable(),
  versionCode: yup
    .number()
    .transform((value, originalValue) => (originalValue === "" ? undefined : Number(originalValue)))
    .optional()
    .nullable(),
});

export type CheckAppVersionDto = yup.InferType<typeof CheckAppVersionSchema>;
