import * as yup from "yup";
import { BadRequestError } from "./http.error";

// رسائل Yup الافتراضية بالعربية للحقول التي لا تحدد رسالة خاصة بها
yup.setLocale({
  mixed: {
    default: "قيمة الحقل ${path} غير صالحة",
    required: "حقل ${path} مطلوب",
    oneOf: "قيمة الحقل ${path} يجب أن تكون إحدى القيم: ${values}",
    notType: "نوع القيمة في الحقل ${path} غير صحيح",
  },
  string: {
    min: "الحقل ${path} يجب أن لا يقل عن ${min} أحرف",
    max: "الحقل ${path} يجب أن لا يزيد عن ${max} حرفاً",
    email: "البريد الإلكتروني غير صالح",
    uuid: "المعرف في الحقل ${path} غير صالح",
    url: "الرابط في الحقل ${path} غير صالح",
    matches: "صيغة الحقل ${path} غير صحيحة",
  },
  number: {
    min: "الحقل ${path} يجب أن يكون أكبر من أو يساوي ${min}",
    max: "الحقل ${path} يجب أن يكون أصغر من أو يساوي ${max}",
    integer: "الحقل ${path} يجب أن يكون رقماً صحيحاً",
    positive: "الحقل ${path} يجب أن يكون رقماً موجباً",
  },
  date: {
    min: "التاريخ في الحقل ${path} يجب أن يكون بعد ${min}",
    max: "التاريخ في الحقل ${path} يجب أن يكون قبل ${max}",
  },
  array: {
    min: "الحقل ${path} يجب أن يحتوي على ${min} عناصر على الأقل",
    max: "الحقل ${path} يجب أن لا يحتوي على أكثر من ${max} عناصر",
  },
});

export const validator = async <T extends yup.AnySchema>(
  schema: T,
  data: unknown
): Promise<yup.InferType<T>> => {
  try {
    return await schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
    });
  } catch (err) {
    if (err instanceof yup.ValidationError) {
      const errorDetails = err.inner?.length
        ? err.inner.map((e) => ({ path: e.path, message: e.message }))
        : [{ path: err.path, message: err.message }];
      throw new BadRequestError(err.errors.join("، "), errorDetails);
    }
    throw err;
  }
};
