# Backend Architecture Constitution — Multi-Tenant Education Library Platform

This document establishes the binding architectural contract, structural patterns, and engineering principles for the Backend of the Multi-Tenant Education Library Platform. Every backend module, service, controller, repository, and route must strictly adhere to these rules.

---

## 1. Core Architectural Paradigm & Technology Stack

* **Runtime**: Node.js with TypeScript.
* **Framework**: Express.js with modular routing.
* **Database**: PostgreSQL.
* **ORM**: Prisma (Translating the repository/service philosophy from the old TypeORM system into clean Prisma abstractions — **no TypeORM compatibility layer**).
* **Validation**: Yup schema validation with inferred TypeScript DTO types.
* **Architecture Flow**:
  $$\text{Request} \longrightarrow \text{Middleware} \longrightarrow \text{Controller} \longrightarrow \text{TenantService/Service} \longrightarrow \text{RepoService (Prisma)} \longrightarrow \text{Database}$$

---

## 2. Directory & File Organization Rules

The backend codebase must follow this standard directory structure:

```text
backend/
├── prisma/
│   ├── schema.prisma              # Database schema definitions and relations
│   ├── migrations/                # Generated SQL migrations
│   └── seed.ts                    # Initial platform seeder (Super Admin, default setup)
├── src/
│   ├── common/
│   │   ├── errors/
│   │   │   ├── Ensure.handler.ts  # Assertion helper (Ensure.exists, Ensure.required, etc.)
│   │   │   ├── ErrorMessages.ts   # Bilingual error dictionary (ar / en)
│   │   │   ├── http.error.ts      # HttpError, BadRequestError, UnauthorizedError, etc.
│   │   │   ├── api.error.ts       # APIError class and HttpStatusCode enum
│   │   │   ├── error.handler.ts   # Global Express error middleware
│   │   │   └── validator.ts       # Yup schema validation runner
│   │   └── responses/
│   │       └── api.response.ts    # Standard ApiResponse envelope (data, message, meta)
│   ├── config/
│   │   ├── prisma.ts              # Global Prisma client instance
│   │   └── environment.ts         # Environment configuration (NODE_ENV, secrets, ports)
│   ├── types/
│   │   ├── express.d.ts           # Request context augmentation (user, tenant)
│   │   └── tenant.context.ts      # TenantContext interface
│   ├── middlewares/
│   │   ├── auth.middleware.ts     # JWT verification and user resolution
│   │   ├── tenant.middleware.ts   # Resolves libraryId & active timePeriodId from context
│   │   ├── role.middleware.ts     # Role-based access control (checkRole)
│   │   └── checkUserStatus.ts     # User active status check
│   ├── dto/                       # Yup schemas and inferred TypeScript types
│   │   ├── auth/
│   │   ├── library/
│   │   ├── time-period/
│   │   ├── branch/
│   │   ├── department/
│   │   ├── student/
│   │   ├── subject/
│   │   ├── content/
│   │   └── subscription/
│   ├── services/
│   │   ├── repo.service.ts        # Generic Prisma RepoService base class
│   │   ├── tenant.service.ts      # Multi-tenant scoping base class extending RepoService
│   │   └── domain/                # Domain-specific services inheriting from TenantService
│   │       ├── auth.service.ts
│   │       ├── library.service.ts
│   │       ├── time-period.service.ts
│   │       ├── branch.service.ts
│   │       ├── department.service.ts
│   │       ├── student.service.ts
│   │       ├── subject.service.ts
│   │       ├── lecture.service.ts
│   │       ├── gold.service.ts
│   │       ├── summary.service.ts
│   │       ├── course.service.ts
│   │       ├── question-bank.service.ts
│   │       └── subscription.service.ts
│   ├── controllers/               # Express Controllers handling HTTP contracts
│   │   ├── auth.controller.ts
│   │   ├── library.controller.ts
│   │   ├── time-period.controller.ts
│   │   ├── branch.controller.ts
│   │   ├── department.controller.ts
│   │   ├── student.controller.ts
│   │   ├── subject.controller.ts
│   │   ├── lecture.controller.ts
│   │   ├── gold.controller.ts
│   │   ├── summary.controller.ts
│   │   ├── course.controller.ts
│   │   ├── question-bank.controller.ts
│   │   └── subscription.controller.ts
│   ├── routes/                    # Route registrations mounting controllers
│   │   ├── index.ts               # Main router mounting all feature routers
│   │   └── ...
│   └── index.ts                   # Express application entry point & listener
├── role.md                        # This architecture contract
├── package.json
└── tsconfig.json
```

---

## 3. The Service Inheritance Hierarchy: `RepoService` & `TenantService`

### 3.1 Base `RepoService` (Prisma Abstraction)
* Translates the old TypeORM `RepoService` into a clean Prisma equivalent.
* Provides standard generic database operations: `create`, `update`, `delete`, `getById`, `getAll`, `getAllWithPagination`, `findOneByCondition`, `findManyByCondition`, `exists`, `count`.
* Uses `Ensure.exists` to assert presence of records and normalize IDs.

### 3.2 The Mandatory New Abstraction: `TenantService`
```text
RepoService
    ↓
TenantService
    ↓
Domain Services (StudentService, SubjectService, SubscriptionService, etc.)
```

* **Purpose**: Automatically applies `libraryId` and `timePeriodId` to tenant-scoped operations.
* **Contract**:
  * Receives `tenantContext: TenantContext` (`{ libraryId: string; timePeriodId?: string }`).
  * Intercepts `create`, `update`, `delete`, `findOne`, `findMany`, `getAllWithPagination` to automatically include:
    * `where.libraryId = tenantContext.libraryId`
    * `where.timePeriodId = tenantContext.timePeriodId` (when model is period-scoped)
    * `data.libraryId = tenantContext.libraryId`
    * `data.timePeriodId = tenantContext.timePeriodId` (when model is period-scoped)
* **Domain Service Simplicity**:
  Domain services call:
  ```ts
  this.create(data);
  this.findMany({ where: { isActive: true } });
  this.getById(id);
  ```
  without manually typing `where: { libraryId: ... }` everywhere.

---

## 4. Tenant Context & Security Rules

1. **Zero Trust for Client-Provided Tenant IDs**:
   * The client must NEVER supply `libraryId` in request bodies or query parameters for tenant operations.
   * `libraryId` is strictly resolved on the server from the authenticated user (`req.user.libraryId`).
   * For `SUPER_ADMIN`, global queries are permitted, or the Super Admin may optionally inspect a specific library via explicit administrative routes.
2. **Current Time Period Context**:
   * For `LIBRARY_ADMIN`, default operations always target the library's currently `ACTIVE` Time Period.
   * If an admin inspects an archived period, `timePeriodId` is explicitly passed via query parameter (`?timePeriodId=...`) only on designated historical endpoints.
3. **Cross-Tenant Data Leakage Prevention**:
   * Every query verifying relations must ensure both the parent and child belong to the same `libraryId`.
   * Composite database constraints and foreign keys enforce tenant boundaries at the database level.

---

## 5. Time Period Lifecycle & Content Rules

1. **Single Active Period**:
   * Exactly ONE Time Period per Library can be `status: 'ACTIVE'`.
   * Activating a new Time Period automatically switches the previously active period to `'ARCHIVED'`.
2. **Subscription Expiration Lifecycle**:
   * When a Time Period closes, its active subscriptions automatically become `'EXPIRED'`.
   * Subscriptions are **NEVER permanently deleted** upon period closure.
   * Historical data must be retained indefinitely for reporting and auditing.
3. **Content Reuse / Copy**:
   * Educational materials (lectures, gold papers, summaries, courses, questions) from an archived period can be copied/reused into the current period.
   * The copy operation creates a **new independent record** in the current period referencing or cloning the content.
   * Mutating the archived record's `timePeriodId` is strictly forbidden because it destroys historical records.
4. **Data Cleanup**:
   * Destructive removal of old period data is only allowed via an explicit, dedicated administrative action with double confirmation.

---

## 6. Academic Structure Rules

1. **No Sections (شعب)**:
   * There is strictly NO concept of sections / شعب in this system.
2. **Branch & Department Hierarchy**:
   $$\text{Library} \longrightarrow \text{Branch} \longrightarrow \text{Department (Optional)} \longrightarrow \text{Student}$$
   * A Branch has a boolean flag: `hasDepartments`.
   * If `hasDepartments === true`, a Department must be created under the Branch, and registered students in that Branch must specify a valid Department.
   * If `hasDepartments === false`, students belong directly to the Branch without any Department.

---

## 7. Educational Feature Domain Rules

The platform supports 5 independent educational features. They must NOT be merged into a single generic entity with boolean flags:

1. **Lectures**:
   * Lecture service model: A student subscribes to the *lecture service* for a subject during a period.
   * When new lecture content (video/PDF) is uploaded, all existing active subscribers to that subject's lecture service automatically gain access without re-subscribing.
   * Uploading a new lecture dispatches notifications to active subscribers.
2. **Gold Papers**:
   * Independent educational materials/exam reviews with separate subscription.
3. **Summaries**:
   * Independent summary notes and cheat-sheets with separate subscription.
4. **Courses**:
   * Structured multi-lesson courses (Course $\rightarrow$ Lessons 1, 2, 3...) with separate subscription.
5. **Question Bank**:
   * Structured interactive data (NOT static files!).
   * Stores: question text, question type (multiple-choice, true/false), options array, correct answer, explanation, difficulty.
   * Frontend displays and validates questions interactively.

---

## 8. Controller & Route Conventions

1. **Controller Pattern**:
   * Controllers contain ZERO direct database queries.
   * Extract input, validate via Yup schema: `await validator(Schema, req.body)`.
   * Invoke domain service.
   * Return standardized response via `ApiResponse.success(data, message, meta)`.
   * Handle errors through `next(error)` catch block.
2. **Route Definition Pattern**:
   * Express `Router` per feature.
   * Middleware chain: `authMiddleware`, `checkUserStatus`, `checkRole([...])`, `tenantMiddleware`.
   * Pass execution to controller method: `(req, res, next) => controller.action(req, res, next)`.

---

## 9. Error Handling & Response Standards

1. **Ensure Assertions**:
   * Use `Ensure.exists(item, 'student')` $\rightarrow$ Throws `NotFoundError` (404).
   * Use `Ensure.required(field, 'name')` $\rightarrow$ Throws `BadRequestError` (400).
   * Use `Ensure.alreadyExists(exists, 'email')` $\rightarrow$ Throws `BadRequestError` (400).
   * Use `Ensure.forbidden(condition, 'permission')` $\rightarrow$ Throws `ForbiddenError` (403).
2. **API Response Envelope**:
   ```json
   {
     "success": true,
     "message": "تمت العملية بنجاح",
     "data": { ... },
     "meta": {
       "total": 100,
       "page": 1,
       "limit": 10,
       "totalPages": 10
     }
   }
   ```
3. **Language Support**:
   * Detect language via `req.headers['accept-language']` (defaults to `'ar'`).
   * `ErrorMessages.generateErrorMessage(entity, action, lang)` outputs appropriate Arabic or English error descriptions.

---

## 10. Strictly Prohibited Patterns

* ❌ **DO NOT** use TypeORM. Prisma is mandatory.
* ❌ **DO NOT** trust client-provided `libraryId` or `timePeriodId` in mutation bodies.
* ❌ **DO NOT** manually duplicate `where: { libraryId }` across every service method; let `TenantService` handle it.
* ❌ **DO NOT** physically delete subscriptions upon period expiration.
* ❌ **DO NOT** mutate an archived content record's `timePeriodId` when copying/reusing content.
* ❌ **DO NOT** introduce Sections (شعب).
* ❌ **DO NOT** implement Question Bank as raw uploaded files.
* ❌ **DO NOT** put business logic inside controllers or HTTP logic inside repositories.
