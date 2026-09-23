# دستور ومعايير الـ Agent للواجهة الخلفية (Backend)
## Multi-Tenant Education Library Platform — Backend Constitution

> **تحذير إلزامي لجميع نماذج الذكاء الاصطناعي والمطورين (Strict AI Agent Directive):**
> هذا الملف يمثل الدستور المعماري الصارم والملزم للواجهة الخلفية (`backend`).
> يمنع منعاً باتاً لأي عملية توليد كود (Code Generation)، أو كتابة خدمات (Services)، أو إنشاء مسارات (Routes)، أو بناء وحدات تحكم (Controllers)، مخالفة أي قاعدة من القواعد المنصوص عليها أدناه.
> خرق هذه القواعد يهدد عزل البيانات بين المكتبات (Data Leakage) ويكسر استقرار النظام.

---

## 1. التدفق المعماري الأساسي (Architectural Flow)

يسير أي طلب HTTP في النظام وفق هذا التسلسل الصارم ذي الطبقات الأربع:

$$\text{Request} \longrightarrow \text{Middlewares (Auth, Tenant, Role)} \longrightarrow \text{Controller} \longrightarrow \text{TenantService / Domain Service} \longrightarrow \text{RepoService (Prisma)} \longrightarrow \text{PostgreSQL Database}$$

### التقنيات المعتمدة:
* **بيئة التشغيل**: Node.js مع TypeScript.
* **إطار العمل**: Express.js بتوجيه معياري مقسم.
* **قاعدة البيانات**: PostgreSQL.
* **طبقة الـ ORM**: Prisma حصراً (يحظر استخدام TypeORM أو أي طبقات توافقية معه).
* **التحقق من المدخلات**: Yup Schemas مع استنتاج أنواع TypeScript DTO تلقائياً.

---

## 2. الهيكلية المعيارية للمجلدات والملفات

```text
backend/
├── prisma/
│   ├── schema.prisma              # مخطط قاعدة البيانات والعلاقات والفهارس
│   ├── migrations/                # ملفات ترحيل SQL المولدة
│   └── seed.ts                    # بذور البيانات الابتدائية للمنصة
├── src/
│   ├── common/
│   │   ├── errors/
│   │   │   ├── Ensure.handler.ts  # أداة التوكيد الصارم (Ensure.exists, Ensure.required...)
│   │   │   ├── ErrorMessages.ts   # قاموس الأخطاء ثنائي اللغة (عربي / إنجليزي)
│   │   │   ├── http.error.ts      # HttpError, NotFoundError, BadRequestError...
│   │   │   ├── api.error.ts       # كلاس APIError وتعداد HttpStatusCode
│   │   │   ├── error.handler.ts   # Express Global Error Middleware
│   │   │   └── validator.ts       # أداة فحص مخططات Yup
│   │   └── responses/
│   │       └── api.response.ts    # غلاف الاستجابة الموحد (ApiResponse)
│   ├── config/
│   │   ├── prisma.ts              # النسخة العامة لعميل Prisma
│   │   └── environment.ts         # إعدادات البيئة والمفاتيح السرية
│   ├── types/
│   │   ├── express.d.ts           # توسيع نوع Request لإضافة user و tenant
│   │   └── tenant.context.ts      # واجهة TenantContext
│   ├── middlewares/
│   │   ├── auth.middleware.ts     # التحقق من JWT واستخراج بيانات المستخدم
│   │   ├── tenant.middleware.ts   # استخراج libraryId و timePeriodId النشطة
│   │   ├── role.middleware.ts     # فحص الصلاحيات (checkRole)
│   │   └── checkUserStatus.ts     # التحقق من حالة تفعيل الحساب
│   ├── dto/                       # مخططات Yup والأنواع المستنتجة
│   ├── services/
│   │   ├── repo.service.ts        # تجريد Prisma العام (RepoService)
│   │   ├── tenant.service.ts      # فئة العزل متعدد المستأجرين (TenantService)
│   │   └── domain/                # الخدمات الوظيفية المرتبطة بالنطاق (Domain Services)
│   ├── controllers/               # معالجة بروتوكول HTTP وإرجاع ApiResponse
│   ├── routes/                    # تسجيل المسارات وربط الـ Middlewares
│   └── index.ts                   # نقطة تشغيل التطبيق وخادم Express
├── package.json
└── tsconfig.json
```

---

## 3. تسلسل وراثة الخدمات الصارم: `RepoService` $\longrightarrow$ `TenantService` $\longrightarrow$ Domain

### 3.1 تجريد Prisma الأساسي (`RepoService`):
* يقدم العمليات الجينيريك العامة للتعامل مع الجداول: `create`, `update`, `delete`, `getById`, `getAll`, `getAllWithPagination`, `findOneByCondition`, `findManyByCondition`, `exists`, `count`.
* يستخدم `Ensure.exists` للتحقق من وجود السجلات تلقائياً.

### 3.2 فئة العزل الصارم متعدد المستأجرين (`TenantService`):
```text
RepoService<T>
      │
      ▼
TenantService<T>  (تطبيق libraryId و timePeriodId تلقائياً)
      │
      ▼
Domain Services (StudentService, SubjectService, SubscriptionService...)
```

* **الهدف المحوري**: تطبيق نطاق المستأجر (`libraryId`) والفترة الزمنية النشطة (`timePeriodId`) على كافة العمليات بشكل آلي دون أي تدخل يدوي في الخدمات الفرعية.
* **آلية العمل**:
  - تستقبل `tenantContext: TenantContext` (`{ libraryId: string; timePeriodId?: string; isSuperAdmin?: boolean }`).
  - تقوم باعتراض (Intercept) عمليات `create`, `update`, `delete`, `findOne`, `findMany`, `getAllWithPagination` لحقن الشروط تلقائياً:
    * `where.libraryId = tenantContext.libraryId`
    * `where.timePeriodId = tenantContext.timePeriodId` (إذا كان النموذج مقيداً بفترة)
    * `data.libraryId = tenantContext.libraryId`
    * `data.timePeriodId = tenantContext.timePeriodId` (إذا كان النموذج مقيداً بفترة)
* **واجب الـ Domain Service**:
  تستدعي العمليات مباشرة:
  ```ts
  this.create(dto);
  this.findMany({ where: { isActive: true } });
  this.getById(id);
  ```
  **ويحظر تماماً كتابة `where: { libraryId: ... }` يدوياً في كل استعلام!**

---

## 4. قواعد أمان المستأجرين (Zero Trust Multi-Tenancy)

1. **انعدام الثقة في البيانات القادمة من الـ Client**:
   * **يمنع منعاً باتاً** قبول `libraryId` أو `timePeriodId` من الـ `req.body` أو `req.query` في عمليات الإنشاء أو التعديل للمستأجرين.
   * يتم استخراج `libraryId` حصراً في الخادم من المستخدم الموثق عبر الـ JWT في `tenantMiddleware` وتمريره عبر `req.tenant`.
   * مستخدم `SUPER_ADMIN` فقط هو المخول بإجراء استعلامات شاملة أو فحص مكتبة بعينها عبر مسارات إدارية مخصصة.
2. **سياق الفترة الزمنية النشطة (Active Time Period)**:
   * لمسؤولي المكتبات (`LIBRARY_ADMIN`)، كافة العمليات تستهدف تلقائياً الفترة النشطة حالياً للمكتبة (`status: 'ACTIVE'`).
   * عند مراجعة فترات مؤرشفة، يتم تمرير `?timePeriodId=...` فقط في مسارات القراءة التاريخية المصرح بها.
3. **منع تسرب البيانات بين المستأجرين (Cross-Tenant Leakage)**:
   * كل استعلام يتحقق من علاقة (Parent-Child) يجب أن يتأكد أن الطرفين يتبعان نفس الـ `libraryId`.

---

## 5. قواعد دورة حياة الفترات الزمنية والمحتوى

1. **فترة نشطة واحدة فقط**:
   * يمكن وجود فترة زمنية واحدة فقط بحالة `ACTIVE` لكل مكتبة في نفس الوقت.
   * تنشيط فترة جديدة يحول الفترة السابقة تلقائياً إلى حالة `ARCHIVED`.
2. **دورة حياة الاشتراكات المنتهية**:
   * عند إغلاق أو أرشفة فترة زمنية، تتحول كافة اشتراكاتها النشطة تلقائياً إلى `EXPIRED`.
   * **يمنع حذف الاشتراكات نهائياً من قاعدة البيانات (No Hard Delete)**؛ البيانات التاريخية يجب أن تظل محفوظة للأرشفة والتقارير المالية والأكاديمية.
3. **إعادة استخدام ونسخ المحتوى التعليمي (Content Reuse)**:
   * عند نقل مواد تعليمية (محاضرات، ملخصات، أوراق ذهبية، كورسات) من فترة مؤرشفة إلى الفترة الحالية:
     - يتم إنشاء **سجل جديد كلياً (New Independent Record)** في الفترة الحالية.
     - **يحظر منعاً باتاً تعديل `timePeriodId` للسجل المؤرشف**، لأن ذلك يمسح تاريخ الفترة السابقة ويفسد تقاريرها.

---

## 6. قواعد الهيكلية الأكاديمية والتعليمية

1. **حظر مفهوم الشعب الأكاديمية (No Sections / شعب)**:
   * **لا يوجد إطلاقاً** مفهوم "الشعب" في هذا النظام، ويحظر إنشاء أي جدول أو حقل يخص الشعب.
2. **التسلسل الهرمي للفروع والأقسام**:
   $$\text{Library} \longrightarrow \text{Branch} \longrightarrow \text{Department (Optional)} \longrightarrow \text{Student}$$
   * يحتوي الفرع على حقل منطقي: `hasDepartments`.
   * إذا كان `hasDepartments === true`: يجب إنشاء أقسام تابعة للفرع، وإلزام الطلاب المسجلين في هذا الفرع بتحديد قسم أكاديمي.
   * إذا كان `hasDepartments === false`: يرتبط الطلاب بالفرع مباشرة دون أي قسم.
3. **الميزات التعليمية الخمس المستقلة**:
   يحتوي النظام على 5 خدمات تعليمية مستقلة لا يجوز دمجها في جدول عام واحد:
   1. **المحاضرات (Lectures)**: نموذج خدمة؛ اشتراك الطالب في خدمة محاضرات المادة يمنحه وصولاً تلقائياً لأي محاضرة جديدة ترفع خلال الفترة دون اشتراك جديد.
   2. **الأوراق الذهبية (Gold Papers)**: ملخصات امتحانية مكثفة ذات اشتراك مستقل.
   3. **الملخصات (Summaries)**: مذكرات ونوتات دراسية ذات اشتراك مستقل.
   4. **الكورسات (Courses)**: دورات مقسمة إلى دروس مرتبة (Course $\rightarrow$ Lessons) ذات اشتراك مستقل.
   5. **بنك الأسئلة (Question Bank)**: بيانات تفاعلية مهيكلة (نص السؤال، نوعه، الخيارات، الإجابة الصحيحة، التفسير، الصعوبة) **وليس ملفات PDF أو ملفات ثابتة**.

---

## 7. معايير وحدات التحكم (Controllers) ونظام الـ DTO

### 7.1 مسؤولية الـ Controller:
* الـ Controller مسؤول فقط عن بروتوكول الـ HTTP:
  1. استخراج المدخلات (`req.body`, `req.params`, `req.query`).
  2. التحقق من صحة المدخلات باستخدام Yup عبر `await validator(Schema, req.body)`.
  3. استدعاء الـ Service المناسبة مع تمرير `req.tenant!`.
  4. إرجاع الاستجابة عبر `ApiResponse.success(data, message, meta)`.
  5. تحويل أي خطأ إلى `next(error)` ليتم التعامل معه في الـ Global Error Middleware.
* **يحظر تماماً كتابة أي استعلام قاعدة بيانات مباشر (Prisma Query) داخل الـ Controller**.

### 7.2 استخدام أدوات التوكيد `Ensure`:
استخدم كلاس `Ensure` للتحقق من الشروط وإطلاق الأخطاء القياسية تلقائياً:
* `Ensure.exists(item, 'اسم الكيان')` $\longrightarrow$ يطلق `NotFoundError` (404).
* `Ensure.required(field, 'اسم الحقل')` $\longrightarrow$ يطلق `BadRequestError` (400).
* `Ensure.alreadyExists(condition, 'البريد أو الحقل')` $\longrightarrow$ يطلق `BadRequestError` (400).
* `Ensure.forbidden(condition, 'رسالة الصلاحية')` $\longrightarrow$ يطلق `ForbiddenError` (403).

### 7.3 صيغة استجابة الـ API الموحدة (`ApiResponse`):
```json
{
  "success": true,
  "message": "تمت العملية بنجاح",
  "data": { ... },
  "meta": {
    "count": 100,
    "page": 1,
    "limit": 10,
    "totalPages": 10
  }
}
```

---

## 8. قائمة الممارسات المحظورة قطيعاً في الواجهة الخلفية

1. ❌ **استخدام TypeORM أو استدعاء أي كلاسات متعلقة به نهائياً**.
2. ❌ **كتابة استعلامات Prisma مباشرة داخل الـ Controllers**.
3. ❌ **الثقة بـ `libraryId` أو `timePeriodId` الممررة في جسم الطلب من العميل**.
4. ❌ **تكرار `where: { libraryId }` يدوياً في كل دالة خدمة بدلاً من الاعتماد على `TenantService`**.
5. ❌ **الحذف الفيزيائي (Hard Delete) للاشتراكات عند انتهاء الفترة الزمنية**.
6. ❌ **تعديل `timePeriodId` للمواد المؤرشفة عند محاولة إعادة استخدامها في فترة جديدة**.
7. ❌ **إنشاء أو اقتراح أي كيان متعلق بـ "الشعب الدراسية" (Sections)**.
8. ❌ **التعامل مع بنك الأسئلة كملفات مرفقة بدلاً من سجلات تفاعلية منظمة**.
9. ❌ **إرجاع استجابات JSON عشوائية دون استخدام `ApiResponse.success`**.
10. ❌ **إجراء عمليات الحذف بدون تأكيدات وفحوصات التبعيات (Relations Check)**.
