/**
 * Idempotent demo data for legacy المستخلصات module (/extracts).
 *
 * Usage:
 *   node scripts/seed-extracts-demo-for-user.mjs [email]
 *   railway run --service gates-backend node scripts/seed-extracts-demo-for-user.mjs h@gmail.com
 */
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const email = (process.argv[2] || 'h@gmail.com').trim().toLowerCase();
const MARKER = 'DEMO-H-EXT';
const prisma = new PrismaClient();

async function ensureContractingLicense(companyId) {
  const sub = await prisma.tenantSubscription.findUnique({ where: { companyId } });
  const modules = ['CONTRACTING', 'ACCOUNTING', 'INVENTORY'];
  if (!sub) {
    await prisma.tenantSubscription.create({
      data: {
        companyId,
        planType: 'ENTERPRISE',
        status: 'ACTIVE',
        startDate: new Date(),
        expiryDate: null,
        maxBranches: 10,
        maxUsers: 50,
        maxStorageMb: 4096,
        allowedModules: modules,
      },
    });
    return 'created subscription';
  }
  const allowed = Array.isArray(sub.allowedModules) ? [...sub.allowedModules] : [];
  let changed = false;
  for (const m of modules) {
    if (!allowed.includes(m)) {
      allowed.push(m);
      changed = true;
    }
  }
  if (changed) {
    await prisma.tenantSubscription.update({
      where: { companyId },
      data: { allowedModules: allowed, status: 'ACTIVE' },
    });
    return 'updated allowedModules';
  }
  return 'subscription ok';
}

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: { equals: email } },
    select: { id: true, email: true, companyId: true, firstName: true },
  });
  if (!user?.companyId) {
    console.error(`No user with email ${email} or missing companyId`);
    process.exit(1);
  }
  const companyId = user.companyId;
  console.log('User:', user.email, 'companyId:', companyId);

  const licenseNote = await ensureContractingLicense(companyId);
  console.log('License:', licenseNote);

  const existingProject = await prisma.project.findFirst({
    where: { companyId, serial: MARKER },
    select: { id: true },
  });
  if (existingProject) {
    const counts = await Promise.all([
      prisma.project.count({ where: { companyId, isActive: true } }),
      prisma.contractor.count({ where: { companyId, isActive: true } }),
      prisma.extract.count({ where: { project: { companyId } } }),
      prisma.extractPayment.count({ where: { project: { companyId } } }),
      prisma.manpowerLog.count({ where: { project: { companyId } } }),
    ]);
    console.log('Demo project already exists — skipping seed.');
    console.log(
      JSON.stringify(
        {
          projectId: existingProject.id,
          activeProjects: counts[0],
          contractors: counts[1],
          extracts: counts[2],
          payments: counts[3],
          manpowerLogs: counts[4],
        },
        null,
        2
      )
    );
    return;
  }

  const project = await prisma.project.create({
    data: {
      companyId,
      serial: MARKER,
      arabicName: 'مشروع تجريبي — برج النيل',
      englishName: 'Demo Nile Tower',
      totalValue: new Decimal(5_000_000),
      advancePaymentPercentage: new Decimal(10),
      advancePaymentValue: new Decimal(500_000),
      latePenaltyPercentage: new Decimal(0.1),
      businessAffairsPercentage: new Decimal(2.5),
      facilitiesDeductionPercentage: new Decimal(1),
      notes: 'بيانات تجريبية للمستخلصات — آمن للحذف لاحقاً',
      isActive: true,
    },
  });

  const building = await prisma.projectBuilding.create({
    data: {
      projectId: project.id,
      groupNumber: 'A',
      modelNumber: 'M-01',
      unitNumber: '101',
      arabicName: 'العمارة أ — وحدة 101',
    },
  });

  const workItems = await Promise.all([
    prisma.projectWorkItem.create({
      data: {
        projectId: project.id,
        buildingId: building.id,
        itemNumber: '01-001',
        itemGroupCode: 'STR',
        itemGroupName: 'إنشاءات',
        arabicName: 'خرسانة مسلحة — أساسات',
        quantity: new Decimal(120),
        unit: 'م3',
        unitPrice: new Decimal(3500),
        totalPrice: new Decimal(420_000),
      },
    }),
    prisma.projectWorkItem.create({
      data: {
        projectId: project.id,
        buildingId: building.id,
        itemNumber: '03-010',
        itemGroupCode: 'FIN',
        itemGroupName: 'تشطيبات',
        arabicName: 'دهانات داخلية',
        quantity: new Decimal(800),
        unit: 'م2',
        unitPrice: new Decimal(85),
        totalPrice: new Decimal(68_000),
      },
    }),
    prisma.projectWorkItem.create({
      data: {
        projectId: project.id,
        itemNumber: '02-005',
        itemGroupCode: 'MEP',
        itemGroupName: 'ميكانيكا',
        arabicName: 'تمديدات سباكة',
        quantity: new Decimal(1),
        unit: 'مقطوعية',
        unitPrice: new Decimal(250_000),
        totalPrice: new Decimal(250_000),
      },
    }),
  ]);

  const contractor = await prisma.contractor.create({
    data: {
      companyId,
      serial: `${MARKER}-CTR`,
      arabicName: 'مقاول تجريبي — حسن للتشطيب',
      englishName: 'Demo Contractor Hassan',
      taxNumber: '123456789',
      phone: '01000000001',
      address: 'القاهرة — التجمع الخامس',
      isActive: true,
    },
  });

  await prisma.contractorSettings.create({
    data: {
      contractorId: contractor.id,
      advancePaymentPercentage: new Decimal(10),
      workInsurancePercentage: new Decimal(2),
      taxDeductionPercentage: new Decimal(5),
    },
  });

  for (const wi of workItems) {
    await prisma.contractorAssignment.create({
      data: {
        projectId: project.id,
        contractorId: contractor.id,
        workItemId: wi.id,
        notes: 'إسناد تجريبي',
      },
    });
  }

  await prisma.projectMeasurementDefinition.createMany({
    data: [
      { projectId: project.id, arabicName: 'سمك الخرسانة', unit: 'سم' },
      { projectId: project.id, arabicName: 'مساحة الدهان', unit: 'م2' },
    ],
  });

  await prisma.manpowerLog.createMany({
    data: [
      {
        projectId: project.id,
        date: new Date('2026-09-01'),
        workerName: 'أحمد — بناء',
        workerType: 'skilled',
        hours: new Decimal(8),
        wage: new Decimal(350),
        notes: 'يومية تجريبية',
      },
      {
        projectId: project.id,
        date: new Date('2026-09-02'),
        workerName: 'محمود — مساعد',
        workerType: 'unskilled',
        hours: new Decimal(8),
        wage: new Decimal(200),
      },
    ],
  });

  const draftExtract = await prisma.extract.create({
    data: {
      projectId: project.id,
      contractorId: contractor.id,
      extractNumber: `${MARKER}-001`,
      extractDate: new Date('2026-09-15'),
      statementType: 'partial',
      extractType: 'contractor',
      statement: 'مستخلص دوري — مسودة',
      totalValue: new Decimal(150_000),
      advancePayment: new Decimal(15_000),
      netWorkValue: new Decimal(135_000),
      previousWorkTotal: new Decimal(0),
      previousExtractCount: 0,
      isPosted: false,
      items: {
        create: [
          {
            workItemId: workItems[0].id,
            buildingId: building.id,
            itemNumber: workItems[0].itemNumber,
            itemName: workItems[0].arabicName,
            quantity: new Decimal(20),
            unit: 'م3',
            unitPrice: new Decimal(3500),
            totalPrice: new Decimal(70_000),
          },
          {
            workItemId: workItems[1].id,
            buildingId: building.id,
            itemNumber: workItems[1].itemNumber,
            itemName: workItems[1].arabicName,
            quantity: new Decimal(200),
            unit: 'م2',
            unitPrice: new Decimal(85),
            totalPrice: new Decimal(17_000),
          },
        ],
      },
    },
  });

  const postedExtract = await prisma.extract.create({
    data: {
      projectId: project.id,
      contractorId: contractor.id,
      extractNumber: `${MARKER}-002`,
      extractDate: new Date('2026-08-01'),
      statementType: 'partial',
      extractType: 'contractor',
      statement: 'مستخلص سابق — مرحّل (عرض لوحة التحكم)',
      totalValue: new Decimal(200_000),
      advancePayment: new Decimal(20_000),
      netWorkValue: new Decimal(180_000),
      previousWorkTotal: new Decimal(0),
      previousExtractCount: 0,
      isPosted: true,
      items: {
        create: [
          {
            workItemId: workItems[2].id,
            itemNumber: workItems[2].itemNumber,
            itemName: workItems[2].arabicName,
            quantity: new Decimal(0.5),
            unit: 'مقطوعية',
            unitPrice: new Decimal(250_000),
            totalPrice: new Decimal(125_000),
          },
        ],
      },
    },
  });

  const ownerExtract = await prisma.extract.create({
    data: {
      projectId: project.id,
      contractorId: null,
      extractNumber: `${MARKER}-OWN-01`,
      extractDate: new Date('2026-09-20'),
      statementType: 'partial',
      extractType: 'owner',
      statement: 'مستخلص مالك — تجريبي',
      totalValue: new Decimal(90_000),
      netWorkValue: new Decimal(90_000),
      isPosted: false,
      items: {
        create: [
          {
            itemName: 'أعمال إدارية — مالك',
            quantity: new Decimal(1),
            unit: 'مقطوعية',
            unitPrice: new Decimal(90_000),
            totalPrice: new Decimal(90_000),
          },
        ],
      },
    },
  });

  const postedPayment = await prisma.extractPayment.create({
    data: {
      extractId: postedExtract.id,
      projectId: project.id,
      contractorId: contractor.id,
      paymentNumber: `${MARKER}-PAY-01`,
      paymentDate: new Date('2026-08-10'),
      paymentAmount: new Decimal(100_000),
      totalExtracts: new Decimal(180_000),
      totalPaid: new Decimal(100_000),
      description: 'دفعة جزئية — مرحّلة',
      isPosted: true,
    },
  });

  const pendingPayment = await prisma.extractPayment.create({
    data: {
      extractId: draftExtract.id,
      projectId: project.id,
      contractorId: contractor.id,
      paymentNumber: `${MARKER}-PAY-02`,
      paymentDate: new Date('2026-09-25'),
      dueDate: new Date('2026-10-05'),
      paymentAmount: new Decimal(50_000),
      totalExtracts: new Decimal(135_000),
      totalPaid: new Decimal(0),
      description: 'دفعة معلّقة — مسودة',
      isPosted: false,
    },
  });

  console.log(
    JSON.stringify(
      {
        seeded: true,
        companyId,
        project: { id: project.id, serial: MARKER, name: project.arabicName },
        buildingId: building.id,
        contractorId: contractor.id,
        workItemIds: workItems.map((w) => w.id),
        extracts: {
          draft: draftExtract.id,
          posted: postedExtract.id,
          owner: ownerExtract.id,
        },
        payments: { posted: postedPayment.id, pending: pendingPayment.id },
        ui: {
          dashboard: '/extracts',
          projects: '/extracts/operations/projects',
          contractor: '/extracts/operations/contractor',
          makeExtract: '/extracts/operations/projects/make-extract',
          payment: '/extracts/operations/extract-payment',
          manpower: '/extracts/operations/manpower-log',
          measurement: '/extracts/operations/project-measurement-definition',
        },
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
