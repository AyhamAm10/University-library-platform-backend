import { prisma } from "../config/prisma";

async function resetTestData() {
  console.log("=== بدء عملية مسح بيانات الاختبار ===");

  try {
    const deletedComplaints = await prisma.complaint.deleteMany({});
    console.log(`- تم حذف الشكاوى: ${deletedComplaints.count}`);

    const deletedNotifications = await prisma.notification.deleteMany({});
    console.log(`- تم حذف الإشعارات: ${deletedNotifications.count}`);

    const deletedRequests = await prisma.subscriptionRequest.deleteMany({});
    console.log(`- تم حذف طلبات الاشتراك: ${deletedRequests.count}`);

    const deletedSubscriptions = await prisma.subscription.deleteMany({});
    console.log(`- تم حذف الاشتراكات: ${deletedSubscriptions.count}`);

    const deletedLectures = await prisma.lecture.deleteMany({});
    console.log(`- تم حذف المحاضرات: ${deletedLectures.count}`);

    const deletedGold = await prisma.goldMaterial.deleteMany({});
    console.log(`- تم حذف الذهبيات: ${deletedGold.count}`);

    const deletedSummaries = await prisma.summaryMaterial.deleteMany({});
    console.log(`- تم حذف الملخصات: ${deletedSummaries.count}`);

    const deletedLessons = await prisma.courseLesson.deleteMany({});
    console.log(`- تم حذف دروس الكورسات: ${deletedLessons.count}`);

    const deletedCourses = await prisma.course.deleteMany({});
    console.log(`- تم حذف الكورسات: ${deletedCourses.count}`);

    const deletedQuestions = await prisma.questionBankItem.deleteMany({});
    console.log(`- تم حذف بنك الأسئلة: ${deletedQuestions.count}`);

    const deletedFiles = await prisma.storedFile.deleteMany({});
    console.log(`- تم حذف الملفات المخزنة: ${deletedFiles.count}`);

    const deletedSubjects = await prisma.subject.deleteMany({});
    console.log(`- تم حذف المواد الدراسية: ${deletedSubjects.count}`);

    const deletedStudents = await prisma.student.deleteMany({});
    console.log(`- تم حذف الطلاب: ${deletedStudents.count}`);

    const deletedYears = await prisma.academicYear.deleteMany({});
    console.log(`- تم حذف السنوات الدراسية: ${deletedYears.count}`);

    const deletedDepartments = await prisma.department.deleteMany({});
    console.log(`- تم حذف الأقسام: ${deletedDepartments.count}`);

    const deletedBranches = await prisma.branch.deleteMany({});
    console.log(`- تم حذف الفروع: ${deletedBranches.count}`);

    console.log("\n=== التحقق من البيانات الأساسية المتبقية (المحفوظة) ===");
    const librariesCount = await prisma.library.count();
    const timePeriodsCount = await prisma.timePeriod.count();
    const usersCount = await prisma.user.count();
    const users = await prisma.user.findMany({
      select: { fullName: true, phone: true, role: true, library: { select: { name: true } } },
    });

    console.log(`- عدد المكتبات المحفوظة: ${librariesCount}`);
    console.log(`- عدد الفترات الزمنية المحفوظة: ${timePeriodsCount}`);
    console.log(`- عدد المدراء والسوبر أدمن المحفوظين: ${usersCount}`);
    users.forEach((u) => {
      console.log(`  * مستخدم: ${u.fullName} (${u.phone}) - الدور: ${u.role} - المكتبة: ${u.library?.name || "بدون مكتبة (سوبر أدمن)"}`);
    });

    console.log("\n تم تنظيف البيانات بنجاح والبدء على بياض!");
  } catch (error) {
    console.error("❌ حدث خطأ أثناء مسح البيانات:", error);
  } finally {
    await prisma.$disconnect();
  }
}

resetTestData();
