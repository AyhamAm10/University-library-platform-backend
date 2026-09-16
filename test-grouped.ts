import { prisma } from './src/config/prisma';
import { GroupedContentService } from './src/services/domain/grouped-content.service';
import { SubscriptionRequestService } from './src/services/domain/subscription-request.service';
import { FeatureType } from '@prisma/client';

async function test() {
  const student = await prisma.student.findFirst();
  const period = await prisma.timePeriod.findFirst({
    where: { libraryId: student!.libraryId, status: 'ACTIVE' }
  });

  const tenantContext = {
    libraryId: student!.libraryId,
    timePeriodId: period!.id,
    role: 'STUDENT' as const,
    userId: student!.id,
  };

  const requestService = new SubscriptionRequestService(tenantContext);
  const subjectId = '6a28ddf3-3931-4b82-96a5-0cf4c2fdab17'; // انكليزي 2

  console.log('--- 1. Submitting Subscription Request ---');
  const req = await requestService.createRequest({
    subjectId,
    featureType: FeatureType.LECTURES,
  }, student!.id);
  console.log('Created Request:', { id: req.id, status: req.status, subjectId: req.subjectId });

  console.log('--- 2. Checking Grouped Content after request ---');
  const groupedService = new GroupedContentService(tenantContext);
  let res = await groupedService.getGroupedContent(FeatureType.LECTURES);
  const unsubSubject = res.unsubscribed.find(s => s.subjectId === subjectId);
  console.log('Unsubscribed subject hasPendingRequest:', unsubSubject?.hasPendingRequest, 'pendingRequestId:', unsubSubject?.pendingRequestId);

  console.log('--- 3. Admin Approves Request ---');
  const adminContext = {
    libraryId: student!.libraryId,
    timePeriodId: period!.id,
    role: 'LIBRARY_ADMIN' as const,
    userId: 'admin-test',
  };
  const adminRequestService = new SubscriptionRequestService(adminContext);
  const approved = await adminRequestService.approveRequest(req.id);
  console.log('Approved Result:', { requestStatus: approved.request.status, subscriptionStatus: approved.subscription.status });

  console.log('--- 4. Checking Grouped Content after approval ---');
  res = await groupedService.getGroupedContent(FeatureType.LECTURES);
  console.log('Subscribed subjects count =', res.subscribed.length);
  console.log('Subscribed subject names:', res.subscribed.map(s => s.subjectName));
  console.log('Lectures in subscribed subject:', res.subscribed[0]?.items?.map((i: any) => i.title));
}

test().catch(console.error).finally(() => prisma.$disconnect());
