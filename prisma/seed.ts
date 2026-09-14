import { PrismaClient, UserRole, PeriodStatus, FeatureType, SubscriptionStatus, QuestionType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // 1. Super Admin
  const superAdminPassword = await bcrypt.hash("password123", 10);
  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@platform.com" },
    update: {},
    create: {
      email: "superadmin@platform.com",
      fullName: "مدير المنصة العام",
      passwordHash: superAdminPassword,
      role: UserRole.SUPER_ADMIN,
      isActive: true,
    },
  });
  console.log("Super admin created:", superAdmin.email);

  // 2. Sample Library A: مكتبة الأفق الأكاديمية
  const libraryA = await prisma.library.upsert({
    where: { code: "HORIZON" },
    update: {},
    create: {
      name: "مكتبة الأفق الأكاديمية",
      code: "HORIZON",
      phone: "0501234567",
      address: "الرياض - تقاطع الملك فهد مع التحلية",
      primaryColor: "#1a73e8",
      secondaryColor: "#34a853",
      isActive: true,
    },
  });

  // Sample Library B: مكتبة دار الحكمة (For testing tenant isolation)
  const libraryB = await prisma.library.upsert({
    where: { code: "HIKMA" },
    update: {},
    create: {
      name: "مكتبة دار الحكمة التعليمية",
      code: "HIKMA",
      phone: "0559876543",
      address: "جدة - حي الجامعة",
      primaryColor: "#0d9488",
      secondaryColor: "#e11d48",
      isActive: true,
    },
  });

  // 3. Library Admins
  const adminPassword = await bcrypt.hash("password123", 10);
  const libraryAAdmin = await prisma.user.upsert({
    where: { email: "admin@horizon.com" },
    update: {},
    create: {
      email: "admin@horizon.com",
      fullName: "أ. خالد العمري (مدير مكتبة الأفق)",
      passwordHash: adminPassword,
      role: UserRole.LIBRARY_ADMIN,
      libraryId: libraryA.id,
      isActive: true,
    },
  });

  const libraryBAdmin = await prisma.user.upsert({
    where: { email: "admin@hikma.com" },
    update: {},
    create: {
      email: "admin@hikma.com",
      fullName: "أ. سامي الغامدي (مدير دار الحكمة)",
      passwordHash: adminPassword,
      role: UserRole.LIBRARY_ADMIN,
      libraryId: libraryB.id,
      isActive: true,
    },
  });

  // 4. Time Periods for Library A
  // Archived Period
  const archivedPeriod = await prisma.timePeriod.create({
    data: {
      libraryId: libraryA.id,
      name: "الفصل الصيفي 2026 (مؤرشف)",
      startDate: new Date("2026-06-01"),
      endDate: new Date("2026-08-30"),
      status: PeriodStatus.ARCHIVED,
    },
  });

  // Active Period
  const activePeriod = await prisma.timePeriod.create({
    data: {
      libraryId: libraryA.id,
      name: "الفصل الدراسي الأول 2026/2027",
      startDate: new Date("2026-09-01"),
      endDate: new Date("2027-01-31"),
      status: PeriodStatus.ACTIVE,
    },
  });

  // Active Period for Library B
  await prisma.timePeriod.create({
    data: {
      libraryId: libraryB.id,
      name: "الفصل الأول 2026/2027 - الحكمة",
      startDate: new Date("2026-09-01"),
      endDate: new Date("2027-01-31"),
      status: PeriodStatus.ACTIVE,
    },
  });

  // 5. Branches for Library A
  const mainBranch = await prisma.branch.create({
    data: {
      libraryId: libraryA.id,
      name: "الفرع الرئيسي - الرياض",
      code: "RUH-01",
      hasDepartments: true,
      isActive: true,
    },
  });

  const jeddahBranch = await prisma.branch.create({
    data: {
      libraryId: libraryA.id,
      name: "فرع جدة الإقليمي",
      code: "JED-01",
      hasDepartments: false, // Students belong directly to this branch
      isActive: true,
    },
  });

  // Departments for mainBranch
  const deptResearch = await prisma.department.create({
    data: {
      libraryId: libraryA.id,
      branchId: mainBranch.id,
      name: "قسم المناهج والبحث العلمي",
      code: "DEPT-RES",
      isActive: true,
    },
  });

  const deptPsychology = await prisma.department.create({
    data: {
      libraryId: libraryA.id,
      branchId: mainBranch.id,
      name: "قسم علم النفس والتربية",
      code: "DEPT-PSY",
      isActive: true,
    },
  });

  // 6. Subjects for Library A
  const subjectResearch = await prisma.subject.create({
    data: {
      libraryId: libraryA.id,
      name: "مناهج البحث العلمي وإعداد الرسائل",
      code: "RES-101",
      description: "المفاهيم الأساسية لأصول البحث العلمي وطرق جمع البيانات الإحصائية",
      isActive: true,
    },
  });

  const subjectPsychology = await prisma.subject.create({
    data: {
      libraryId: libraryA.id,
      name: "علم النفس التربوي المتقدم",
      code: "PSY-201",
      description: "نظريات التعلم الحديثة وتطبيقاتها في البيئة الصفية",
      isActive: true,
    },
  });

  const subjectMethods = await prisma.subject.create({
    data: {
      libraryId: libraryA.id,
      name: "استراتيجيات التدريس الفعال",
      code: "MET-301",
      description: "طرق التدريس التفاعلية وتصميم الأنشطة الصفية",
      isActive: true,
    },
  });

  // 7. Students for Library A
  const student1 = await prisma.student.create({
    data: {
      libraryId: libraryA.id,
      branchId: mainBranch.id,
      departmentId: deptResearch.id,
      fullName: "أحمد بن محمد السالم",
      dateOfBirth: new Date("2002-04-15"),
      phone: "0541112233",
      email: "ahmed.salem@student.com",
      isActive: true,
    },
  });

  const student2 = await prisma.student.create({
    data: {
      libraryId: libraryA.id,
      branchId: jeddahBranch.id,
      departmentId: null, // Branch has no departments!
      fullName: "فاطمة بنت عبد الله الشريف",
      dateOfBirth: new Date("2003-08-22"),
      phone: "0564445566",
      email: "fatima.shareef@student.com",
      isActive: true,
    },
  });

  // 8. Content in Archived Period (for testing Content Reuse / Copy)
  const archivedLecture = await prisma.lecture.create({
    data: {
      libraryId: libraryA.id,
      timePeriodId: archivedPeriod.id,
      subjectId: subjectResearch.id,
      title: "محاضرة صيفية: مدخل إلى البحث الإجرائي",
      description: "تسجيل شامل لمفاهيم البحث الإجرائي في المدارس",
      videoUrl: "https://videos.education.org/summer-res-01.mp4",
      attachmentUrl: "https://docs.education.org/summer-res-01.pdf",
      orderIndex: 1,
    },
  });

  // 9. Content in Current Active Period
  await prisma.lecture.create({
    data: {
      libraryId: libraryA.id,
      timePeriodId: activePeriod.id,
      subjectId: subjectResearch.id,
      title: "المحاضرة الأولى: صياغة الفرضيات والإشكالية",
      description: "شرح تفصيلي لكيفية تحديد مشكلة البحث وبناء الفرضيات البحثية",
      videoUrl: "https://videos.education.org/lec-res-01.mp4",
      attachmentUrl: "https://docs.education.org/lec-res-01.pdf",
      orderIndex: 1,
    },
  });

  await prisma.goldMaterial.create({
    data: {
      libraryId: libraryA.id,
      timePeriodId: activePeriod.id,
      subjectId: subjectResearch.id,
      title: "الأوراق الذهبية الشاملة — مناهج البحث",
      description: "المذكرة الذهبية المعتمدة للمراجعة النهائية للاختبار الفصلي",
      fileUrl: "https://docs.education.org/gold-res-2026.pdf",
    },
  });

  await prisma.summaryMaterial.create({
    data: {
      libraryId: libraryA.id,
      timePeriodId: activePeriod.id,
      subjectId: subjectPsychology.id,
      title: "ملخص خرائط المفاهيم لنظريات التعلم",
      description: "مخططات بصرية تجمع نظريات بياجيه وفيغوتسكي وبرونر",
      fileUrl: "https://docs.education.org/summary-psy-2026.pdf",
    },
  });

  const course1 = await prisma.course.create({
    data: {
      libraryId: libraryA.id,
      timePeriodId: activePeriod.id,
      subjectId: subjectMethods.id,
      title: "دورة التميز في التعلم النشط",
      description: "كورس تدريبي عملي مكون من 4 محاور مع نماذج تطبيقية",
      thumbnailUrl: "https://images.education.org/course-active-learning.jpg",
    },
  });

  await prisma.courseLesson.createMany({
    data: [
      { courseId: course1.id, title: "الدرس 1: كسر الجمود وبناء الدافعية", duration: "18:30", orderIndex: 1 },
      { courseId: course1.id, title: "الدرس 2: استراتيجيات التفكير الناقد", duration: "24:15", orderIndex: 2 },
      { courseId: course1.id, title: "الدرس 3: أساليب التقويم البديل", duration: "20:00", orderIndex: 3 },
    ],
  });

  // Question Bank items
  await prisma.questionBankItem.create({
    data: {
      libraryId: libraryA.id,
      timePeriodId: activePeriod.id,
      subjectId: subjectResearch.id,
      questionText: "ما هو المتغير المستقل في دراسة أثر استخدام التكنولوجيا على التحصيل الدراسي؟",
      questionType: QuestionType.MULTIPLE_CHOICE,
      options: [
        "التحصيل الدراسي",
        "استخدام التكنولوجيا",
        "ذكاء الطلاب",
        "بيئة الفصل المدرسي"
      ],
      correctAnswer: "استخدام التكنولوجيا",
      explanation: "المتغير المستقل هو السبب أو العامل المؤثر الذي يتم قياس أثره على المتغير التابع (التحصيل).",
      difficulty: "MEDIUM",
    },
  });

  await prisma.questionBankItem.create({
    data: {
      libraryId: libraryA.id,
      timePeriodId: activePeriod.id,
      subjectId: subjectPsychology.id,
      questionText: "يرى فيغوتسكي أن التفاعل الاجتماعي يسبق التطور المعرفي لدى الطفل.",
      questionType: QuestionType.TRUE_FALSE,
      options: ["صواب", "خطأ"],
      correctAnswer: "صواب",
      explanation: "النظرية البنائية الاجتماعية لفيغوتسكي تؤكد أن التعلم والتطور المعرفي نتاج التفاعل الثقافي والاجتماعي.",
      difficulty: "EASY",
    },
  });

  // 10. Subscriptions
  // Active subscription in current period
  await prisma.subscription.create({
    data: {
      libraryId: libraryA.id,
      timePeriodId: activePeriod.id,
      studentId: student1.id,
      subjectId: subjectResearch.id,
      featureType: FeatureType.LECTURES,
      status: SubscriptionStatus.ACTIVE,
      subscribedAt: new Date(),
    },
  });

  // Expired subscription in archived period
  await prisma.subscription.create({
    data: {
      libraryId: libraryA.id,
      timePeriodId: archivedPeriod.id,
      studentId: student1.id,
      subjectId: subjectResearch.id,
      featureType: FeatureType.LECTURES,
      status: SubscriptionStatus.EXPIRED,
      subscribedAt: new Date("2026-06-05"),
      expiresAt: new Date("2026-08-30"),
    },
  });

  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
