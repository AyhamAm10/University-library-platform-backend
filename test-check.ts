import { prisma } from './src/config/prisma';

async function main() {
  const file = await prisma.storedFile.findUnique({ where: { id: '30337b16-7a92-4436-91a7-22f63df20542' } });
  console.log('FILE:', JSON.stringify(file, null, 2));

  const sub = await prisma.subscription.findMany({ where: { studentId: 'fbe75a52-68a7-475a-97e6-18cad1e98681' } });
  console.log('SUBS:', JSON.stringify(sub, null, 2));

  const student = await prisma.student.findUnique({ where: { id: 'fbe75a52-68a7-475a-97e6-18cad1e98681' } });
  console.log('STUDENT:', JSON.stringify(student, null, 2));
}

main().finally(() => prisma.$disconnect());
