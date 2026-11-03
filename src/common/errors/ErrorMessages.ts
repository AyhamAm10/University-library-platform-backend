export type Language = "en" | "ar";

/**
 * قاموس أسماء الكيانات بالعربية — يمنع ظهور أسماء النماذج الإنجليزية (مثل timePeriod)
 * داخل رسائل الأخطاء الموجهة للمستخدم.
 */
const ARABIC_ENTITY_NAMES: Record<string, string> = {
  user: "المستخدم",
  library: "المكتبة",
  timePeriod: "الفترة الزمنية",
  branch: "الفرع",
  department: "القسم",
  academicYear: "السنة الدراسية",
  student: "الطالب",
  subject: "المادة",
  lecture: "المحاضرة",
  goldMaterial: "الورقة الذهبية",
  summaryMaterial: "الملخص",
  course: "الكورس",
  courseLesson: "درس الكورس",
  question: "السؤال",
  questionBankItem: "سؤال بنك الأسئلة",
  storedFile: "الملف",
  subscription: "الاشتراك",
  subscriptionRequest: "طلب الاشتراك",
  notification: "الإشعار",
  complaint: "الشكوى",
  appRelease: "إصدار التطبيق",
  adminPhone: "رقم هاتف المسؤول",
};

const translateEntity = (entity: string, lang: Language): string =>
  lang === "ar" ? ARABIC_ENTITY_NAMES[entity] ?? entity : entity;
export type ErrorType =
  | "not found"
  | "unauthorized"
  | "forbidden"
  | "bad request"
  | "internal"
  | "already exists"
  | "missing fields"
  | "created"
  | "retrieved"
  | "updated"
  | "deleted"
  | "logged in"
  | "min"
  | "required"
  | "invalid";


export class ErrorMessages {
  static generateErrorMessage(
    entity: string,
    errorType: ErrorType = "not found",
    lang: Language = "ar"
  ): string {
    const activeLang: Language = lang === "en" ? "en" : "ar";
    entity = translateEntity(entity, activeLang);

    const messages: Record<Language, Record<ErrorType, string>> = {
      en: {
        "not found": `${entity} not found`,
        "unauthorized": `Unauthorized: ${entity} is not authenticated`,
        "forbidden": `Forbidden: You don't have permission to access ${entity}`,
        "bad request": `Bad Request: Invalid data provided for ${entity}`,
        "internal": `Internal Server Error: Something went wrong with ${entity}`,
        "already exists": `${entity} already exists`,
        "missing fields": `Required fields are missing for ${entity}`,
        "created": `${entity} created successfully`,
        "retrieved": `${entity} retrieved successfully`,
        "updated": `${entity} updated successfully`,
        "deleted": `${entity} deleted successfully`,
        "logged in": "You have successfully logged in",
        "min": `${entity} does not meet minimum length requirement`,
        "required": `${entity} is required`,
        "invalid": `${entity} is invalid`,
      },
      ar: {
        "not found": `بيانات ${entity} غير موجودة`,
        "unauthorized": "غير مصرح، يرجى تسجيل الدخول أولاً",
        "forbidden": `ممنوع: ليس لديك صلاحية للوصول إلى ${entity}`,
        "bad request": `طلب غير صالح: البيانات المدخلة لـ ${entity} غير صحيحة`,
        "internal": `خطأ داخلي في الخادم: حدث خطأ أثناء معالجة ${entity}`,
        "already exists": `${entity} موجود بالفعل ومُستخدم مسبقاً`,
        "missing fields": `الحقول المطلوبة لـ ${entity} غير مكتملة`,
        "created": `تم إنشاء ${entity} بنجاح`,
        "retrieved": `تم جلب بيانات ${entity} بنجاح`,
        "updated": `تم تحديث ${entity} بنجاح`,
        "deleted": `تم حذف ${entity} بنجاح`,
        "logged in": "تم تسجيل الدخول بنجاح",
        "min": `قيمة ${entity} لا تحقق الحد الأدنى المطلوب`,
        "required": `حقل ${entity} مطلوب`,
        "invalid": `القيمة المدخلة لـ ${entity} غير صحيحة`,
      },
    };

    return (
      messages[activeLang][errorType] ||
      messages[activeLang]["internal"] ||
      `${entity} error occurred`
    );
  }
}
