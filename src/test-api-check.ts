import { prisma } from './config/prisma';
import jwt from 'jsonwebtoken';
import { Environment } from './config/environment';

async function testApis() {
  console.log('=== 1. Checking Database Connectivity ===');
  const library = await prisma.library.findFirst();
  console.log('Library found:', library?.name, 'ID:', library?.id);

  const activePeriod = await prisma.timePeriod.findFirst({
    where: { libraryId: library?.id, status: 'ACTIVE' },
  });
  console.log('Active Period:', activePeriod?.name, 'ID:', activePeriod?.id);

  const admin = await prisma.user.findFirst({
    where: { role: 'LIBRARY_ADMIN' },
  });
  console.log('Admin found:', admin?.email, 'ID:', admin?.id);

  const student = await prisma.student.findFirst();
  console.log('Student found:', student?.fullName, 'Phone:', student?.phone, 'ID:', student?.id);

  if (!library || !admin) {
    console.error('Missing library or admin in DB');
    return;
  }

  // Generate valid test JWTs
  const adminToken = jwt.sign(
    {
      userId: admin.id,
      role: admin.role,
      libraryId: admin.libraryId,
    },
    Environment.JWT_ACCESS_SECRET,
    { expiresIn: '1h' }
  );

  let studentToken: string | null = null;
  if (student) {
    studentToken = jwt.sign(
      {
        userId: student.id,
        role: 'STUDENT',
        libraryId: student.libraryId,
      },
      Environment.JWT_ACCESS_SECRET,
      { expiresIn: '1h' }
    );
  }

  const baseUrl = 'http://localhost:4000/api';

  console.log('\n=== 2. Testing API Health ===');
  const healthRes = await fetch(`${baseUrl}/health`);
  console.log('Health:', healthRes.status, await healthRes.json());

  console.log('\n=== 3. Testing Admin Endpoints ===');
  const adminHeaders = {
    Authorization: `Bearer ${adminToken}`,
    'X-Client-Type': 'dashboard',
  };

  for (const feature of ['LECTURES', 'GOLD', 'SUMMARIES', 'QUESTION_BANK']) {
    const res = await fetch(`${baseUrl}/content/grouped?featureType=${feature}`, {
      headers: adminHeaders,
    });
    console.log(`Admin grouped ${feature}: status =`, res.status);
    if (!res.ok) {
      console.log('Error:', await res.text());
    } else {
      const json: any = await res.json();
      console.log(`Success! Subscribed groups: ${json.data?.subscribed?.length}, Unsubscribed groups: ${json.data?.unsubscribed?.length}`);
    }
  }

  const reqRes = await fetch(`${baseUrl}/subscription-requests`, {
    headers: adminHeaders,
  });
  console.log('Admin subscription-requests: status =', reqRes.status);
  if (!reqRes.ok) {
    console.log('Error:', await reqRes.text());
  } else {
    const json: any = await reqRes.json();
    console.log(`Success! Total requests: ${json.data?.items?.length ?? json.data?.length ?? 0}`);
  }

  if (studentToken) {
    console.log('\n=== 4. Testing Student Endpoints ===');
    const studentHeaders = {
      Authorization: `Bearer ${studentToken}`,
      'X-Client-Type': 'student-mobile',
    };

    for (const feature of ['LECTURES', 'GOLD', 'SUMMARIES', 'QUESTION_BANK']) {
      const res = await fetch(`${baseUrl}/content/grouped?featureType=${feature}`, {
        headers: studentHeaders,
      });
      console.log(`Student grouped ${feature}: status =`, res.status);
      if (!res.ok) {
        console.log('Error:', await res.text());
      } else {
        const json: any = await res.json();
        console.log(`Success! Subscribed groups: ${json.data?.subscribed?.length}, Unsubscribed groups: ${json.data?.unsubscribed?.length}`);
      }
    }

    const studentReqRes = await fetch(`${baseUrl}/subscription-requests`, {
      headers: studentHeaders,
    });
    console.log('Student subscription-requests: status =', studentReqRes.status);
    if (!studentReqRes.ok) {
      console.log('Error:', await studentReqRes.text());
    } else {
      const json: any = await studentReqRes.json();
      console.log(`Success! Total student requests: ${json.data?.length ?? 0}`);
    }
  }
}

testApis()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
