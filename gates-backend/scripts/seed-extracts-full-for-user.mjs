/**
 * Full المستخلصات demo — idempotent expand for h@gmail.com company.
 * Safe to re-run: uses stable serials under DEMO-H-*.
 *
 *   railway ssh --service gates-backend -- sh -c 'node - h@gmail.com' < scripts/seed-extracts-full-for-user.mjs
 */
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const email = (process.argv[2] || 'h@gmail.com').trim().toLowerCase();
const PREFIX = 'DEMO-H';
const prisma = new PrismaClient();

const AGENDA_GROUPS = ['تشطيبات', 'أعمال فوق الأرض', 'أعمال تحت الأرض', 'تجهيزات'];

async function ensureContractingLicense(companyId) {
  const modules = ['CONTRACTING', 'ACCOUNTING', 'INVENTORY', 'HR', 'TREASURY'];
  const sub = await prisma.tenantSubscription.findUnique({ where: { companyId } });
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
        maxStorageMb: 8192,
        allowedModules: modules,
      },
    });
    return;
  }
  const allowed = new Set(Array.isArray(sub.allowedModules) ? sub.allowedModules : []);
  for (const m of modules) allowed.add(m);
  await prisma.tenantSubscription.update({
    where: { companyId },
    data: { allowedModules: [...allowed], status: 'ACTIVE' },
  });
}

async function ensureProject(companyId, serial, data) {
  const found = await prisma.project.findFirst({ where: { companyId, serial } });
  if (found) return found;
  return prisma.project.create({ data: { companyId, serial, isActive: true, ...data } });
}

async function ensureBuilding(projectId, unitNumber, data) {
  const found = await prisma.projectBuilding.findFirst({
    where: { projectId, unitNumber },
  });
  if (found) return found;
  return prisma.projectBuilding.create({ data: { projectId, unitNumber, ...data } });
}

async function ensureWorkItem(projectId, itemNumber, data) {
  const found = await prisma.projectWorkItem.findFirst({
    where: { projectId, itemNumber },
  });
  if (found) return found;
  return prisma.projectWorkItem.create({ data: { projectId, itemNumber, ...data } });
}

async function ensureContractor(companyId, serial, data) {
  const found = await prisma.contractor.findFirst({ where: { companyId, serial } });
  if (found) return found;
  return prisma.contractor.create({ data: { companyId, serial, isActive: true, ...data } });
}

async function ensureContractorSettings(contractorId, data, accountId) {
  const existing = await prisma.contractorSettings.findUnique({ where: { contractorId } });
  const otherSettings = accountId ? { contractorAccountId: accountId } : undefined;
  if (existing) {
    if (accountId && !existing.otherSettings?.contractorAccountId) {
      await prisma.contractorSettings.update({
        where: { contractorId },
        data: {
          otherSettings: { ...(existing.otherSettings ?? {}), contractorAccountId: accountId },
        },
      });
    }
    return existing;
  }
  return prisma.contractorSettings.create({
    data: {
      contractorId,
      ...data,
      otherSettings: otherSettings ?? undefined,
    },
  });
}

async function ensureAssignment(projectId, contractorId, workItemId) {
  try {
    await prisma.contractorAssignment.create({
      data: { projectId, contractorId, workItemId, notes: 'إسناد تجريبي' },
    });
  } catch {
    /* unique */
  }
}

async function ensureExtract(projectId, extractNumber, data) {
  const found = await prisma.extract.findFirst({
    where: { projectId, extractNumber },
  });
  if (found) return found;
  return prisma.extract.create({ data: { projectId, extractNumber, ...data } });
}

async function ensurePayment(extractId, projectId, paymentNumber, data) {
  const found = await prisma.extractPayment.findFirst({
    where: { projectId, paymentNumber },
  });
  if (found) return found;
  return prisma.extractPayment.create({
    data: { extractId, projectId, paymentNumber, ...data },
  });
}

async function seedProjectBundle(companyId, cfg) {
  const project = await ensureProject(companyId, cfg.serial, cfg.project);
  const buildings = [];
  for (const b of cfg.buildings) {
    buildings.push(await ensureBuilding(project.id, b.unitNumber, b));
  }
  const workItems = [];
  for (const w of cfg.workItems) {
    const { buildingUnit, ...rest } = w;
    workItems.push(
      await ensureWorkItem(project.id, w.itemNumber, {
        ...rest,
        quantity: new Decimal(rest.quantity),
        unitPrice: rest.unitPrice != null ? new Decimal(rest.unitPrice) : undefined,
        totalPrice: rest.totalPrice != null ? new Decimal(rest.totalPrice) : undefined,
        buildingId: buildingUnit
          ? buildings.find((x) => x.unitNumber === buildingUnit)?.id
          : undefined,
      })
    );
  }
  const contractors = [];
  for (const c of cfg.contractors) {
    contractors.push(await ensureContractor(companyId, c.serial, c));
  }
  for (const c of contractors) {
    await ensureContractorSettings(
      c.id,
      {
        advancePaymentPercentage: new Decimal(10),
        workInsurancePercentage: new Decimal(2.5),
        taxDeductionPercentage: new Decimal(5),
      },
      cfg.glAccountId
    );
  }
  for (const wi of workItems) {
    for (const c of contractors) {
      await ensureAssignment(project.id, c.id, wi.id);
    }
  }
  for (const m of cfg.measurements) {
    const exists = await prisma.projectMeasurementDefinition.findFirst({
      where: { projectId: project.id, arabicName: m.arabicName },
    });
    if (!exists) {
      await prisma.projectMeasurementDefinition.create({
        data: { projectId: project.id, ...m },
      });
    }
  }
  for (const row of cfg.manpower) {
    const exists = await prisma.manpowerLog.findFirst({
      where: { projectId: project.id, workerName: row.workerName, date: row.date },
    });
    if (!exists) {
      await prisma.manpowerLog.create({ data: { projectId: project.id, ...row } });
    }
  }
  const extracts = {};
  for (const ex of cfg.extracts) {
    const contractor = ex.contractorSerial
      ? contractors.find((c) => c.serial === ex.contractorSerial)
      : null;
    const itemCreates = (ex.items ?? []).map((it) => {
      const wi = it.itemNumber
        ? workItems.find((w) => w.itemNumber === it.itemNumber)
        : null;
      const b = it.buildingUnit
        ? buildings.find((x) => x.unitNumber === it.buildingUnit)
        : null;
      return {
        workItemId: wi?.id,
        buildingId: b?.id,
        itemNumber: it.itemNumber,
        itemName: it.itemName ?? wi?.arabicName ?? 'بند',
        quantity: new Decimal(it.quantity),
        unit: it.unit,
        unitPrice: it.unitPrice != null ? new Decimal(it.unitPrice) : undefined,
        totalPrice: it.totalPrice != null ? new Decimal(it.totalPrice) : undefined,
      };
    });
    const row = await ensureExtract(project.id, ex.extractNumber, {
      contractorId: contractor?.id ?? null,
      extractDate: ex.extractDate,
      statementType: ex.statementType ?? 'partial',
      extractType: ex.extractType ?? 'contractor',
      statement: ex.statement,
      totalValue: new Decimal(ex.totalValue),
      advancePayment: ex.advancePayment != null ? new Decimal(ex.advancePayment) : undefined,
      netWorkValue: new Decimal(ex.netWorkValue ?? ex.totalValue),
      previousWorkTotal: new Decimal(ex.previousWorkTotal ?? 0),
      previousExtractCount: ex.previousExtractCount ?? 0,
      isPosted: ex.isPosted ?? false,
      isCancelled: ex.isCancelled ?? false,
      notes: ex.notes,
      items: itemCreates.length ? { create: itemCreates } : undefined,
    });
    extracts[ex.key] = row;
  }
  for (const pay of cfg.payments) {
    const ex = extracts[pay.extractKey];
    if (!ex) continue;
    const contractor = pay.contractorSerial
      ? contractors.find((c) => c.serial === pay.contractorSerial)
      : null;
    await ensurePayment(ex.id, project.id, pay.paymentNumber, {
      contractorId: contractor?.id,
      paymentDate: pay.paymentDate,
      dueDate: pay.dueDate,
      paymentAmount: new Decimal(pay.paymentAmount),
      totalExtracts: new Decimal(pay.totalExtracts),
      totalPaid: new Decimal(pay.totalPaid ?? 0),
      description: pay.description,
      isPosted: pay.isPosted ?? false,
    });
  }
  return { project, buildings, workItems, contractors, extracts };
}

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: { equals: email } },
    select: { email: true, companyId: true },
  });
  if (!user?.companyId) {
    console.error('User not found:', email);
    process.exit(1);
  }
  const companyId = user.companyId;
  await ensureContractingLicense(companyId);

  const glAccount = await prisma.account.findFirst({
    where: { companyId, deletedAt: null, isActive: true },
    orderBy: { code: 'asc' },
    select: { id: true, code: true },
  });

  const p1 = {
    serial: `${PREFIX}-EXT`,
    project: {
      arabicName: 'مشروع تجريبي — برج النيل',
      englishName: 'Demo Nile Tower',
      totalValue: new Decimal(8_500_000),
      advancePaymentPercentage: new Decimal(10),
      advancePaymentValue: new Decimal(850_000),
      latePenaltyPercentage: new Decimal(0.1),
      businessAffairsPercentage: new Decimal(2.5),
      facilitiesDeductionPercentage: new Decimal(1),
      facilitiesDeductionMax: new Decimal(50_000),
      otherAdditions: [{ name: 'إضافة تأمين', value: 15000 }],
      otherDeductions: [{ name: 'خصم تأخير', value: 5000 }],
      notes: 'بيانات تجريبية كاملة — المستخلصات',
    },
    buildings: [
      { unitNumber: '101', groupNumber: 'A', modelNumber: 'M-01', arabicName: 'عمارة أ — 101' },
      { unitNumber: '102', groupNumber: 'A', modelNumber: 'M-02', arabicName: 'عمارة أ — 102' },
      { unitNumber: '201', groupNumber: 'B', modelNumber: 'M-01', arabicName: 'عمارة ب — 201' },
    ],
    workItems: [
      { itemNumber: '01-001', buildingUnit: '101', itemGroupName: 'أعمال تحت الأرض', arabicName: 'حفر وردم', englishName: 'Excavation', quantity: 500, unit: 'م3', unitPrice: 120, totalPrice: 60000 },
      { itemNumber: '01-002', buildingUnit: '101', itemGroupName: 'أعمال فوق الأرض', arabicName: 'خرسانة مسلحة — أساسات', englishName: 'Foundations', quantity: 120, unit: 'م3', unitPrice: 3500, totalPrice: 420000 },
      { itemNumber: '02-010', buildingUnit: '102', itemGroupName: 'أعمال فوق الأرض', arabicName: 'أعمال masonry', englishName: 'Masonry', quantity: 2000, unit: 'م2', unitPrice: 95, totalPrice: 190000 },
      { itemNumber: '03-010', buildingUnit: '102', itemGroupName: 'تشطيبات', arabicName: 'دهانات داخلية', englishName: 'Interior paint', quantity: 1200, unit: 'م2', unitPrice: 85, totalPrice: 102000 },
      { itemNumber: '03-011', buildingUnit: '201', itemGroupName: 'تشطيبات', arabicName: 'أرضيات رخام', englishName: 'Marble floors', quantity: 400, unit: 'م2', unitPrice: 450, totalPrice: 180000 },
      { itemNumber: '04-001', itemGroupName: 'تجهيزات', arabicName: 'مصاعد', englishName: 'Elevators', quantity: 2, unit: 'عدد', unitPrice: 180000, totalPrice: 360000 },
      { itemNumber: '04-002', itemGroupName: 'تجهيزات', arabicName: 'تكييف مركزي', englishName: 'HVAC', quantity: 1, unit: 'مقطوعية', unitPrice: 520000, totalPrice: 520000 },
      { itemNumber: '05-001', buildingUnit: '201', itemGroupName: 'أعمال تحت الأرض', arabicName: 'عزل خزانات', englishName: 'Tank waterproofing', quantity: 800, unit: 'م2', unitPrice: 65, totalPrice: 52000 },
    ],
    contractors: [
      { serial: `${PREFIX}-CTR-01`, arabicName: 'مقاول تجريبي — حسن للتشطيب', englishName: 'Hassan Finishing', taxNumber: '123456789', phone: '01000000001', address: 'التجمع الخامس' },
      { serial: `${PREFIX}-CTR-02`, arabicName: 'مقاول تجريبي — النيل للإنشاءات', englishName: 'Nile Civil', taxNumber: '987654321', phone: '01000000002', address: 'مدينة نصر' },
    ],
    measurements: [
      { arabicName: 'سمك الخرسانة', unit: 'سم' },
      { arabicName: 'مساحة الدهان', unit: 'م2' },
      { arabicName: 'طول التمديدات', unit: 'م' },
      { arabicName: 'ارتفاع البناء', unit: 'م' },
      { arabicName: 'عدد الأبواب', unit: 'عدد' },
      { arabicName: 'حجم الخرسانة', unit: 'م3' },
    ],
    manpower: [
      { date: new Date('2026-08-15'), workerName: 'أحمد — بناء', workerType: 'skilled', hours: 8, wage: 350 },
      { date: new Date('2026-08-16'), workerName: 'محمود — مساعد', workerType: 'unskilled', hours: 8, wage: 200 },
      { date: new Date('2026-08-20'), workerName: 'كريم — مشرف', workerType: 'supervisor', hours: 10, wage: 500 },
      { date: new Date('2026-09-01'), workerName: 'سامي — حداد', workerType: 'skilled', hours: 9, wage: 400 },
      { date: new Date('2026-09-05'), workerName: 'عمر — نقاش', workerType: 'skilled', hours: 8, wage: 380 },
    ],
    extracts: [
      { key: 'posted1', extractNumber: `${PREFIX}-EXT-001`, contractorSerial: `${PREFIX}-CTR-01`, extractDate: new Date('2026-07-01'), totalValue: 200000, advancePayment: 20000, netWorkValue: 180000, isPosted: true, statement: 'مستخلص 1 — مرحّل', items: [{ itemNumber: '01-002', quantity: 30, unit: 'م3', unitPrice: 3500, totalPrice: 105000 }] },
      { key: 'draft', extractNumber: `${PREFIX}-EXT-002`, contractorSerial: `${PREFIX}-CTR-01`, extractDate: new Date('2026-09-15'), totalValue: 150000, advancePayment: 15000, netWorkValue: 135000, isPosted: false, statement: 'مستخلص 2 — مسودة', items: [{ itemNumber: '03-010', quantity: 300, unit: 'م2', unitPrice: 85, totalPrice: 25500 }] },
      { key: 'owner', extractNumber: `${PREFIX}-EXT-OWN`, extractType: 'owner', contractorSerial: null, extractDate: new Date('2026-09-20'), totalValue: 90000, netWorkValue: 90000, isPosted: false, statement: 'مستخلص مالك', items: [{ itemName: 'إشراف مالك', quantity: 1, unit: 'مقطوعية', unitPrice: 90000, totalPrice: 90000 }] },
      { key: 'self', extractNumber: `${PREFIX}-EXT-SELF`, extractType: 'self-execution', contractorSerial: `${PREFIX}-CTR-02`, extractDate: new Date('2026-09-10'), totalValue: 75000, netWorkValue: 75000, isPosted: true, statement: 'تنفيذ ذاتي', items: [{ itemNumber: '04-001', quantity: 1, unit: 'عدد', unitPrice: 75000, totalPrice: 75000 }] },
      { key: 'final', extractNumber: `${PREFIX}-EXT-FINAL`, contractorSerial: `${PREFIX}-CTR-02`, extractDate: new Date('2026-10-01'), statementType: 'final', totalValue: 320000, netWorkValue: 320000, isPosted: false, statement: 'مستخلص نهائي', items: [{ itemNumber: '04-002', quantity: 0.5, unit: 'مقطوعية', unitPrice: 520000, totalPrice: 260000 }] },
      { key: 'cancelled', extractNumber: `${PREFIX}-EXT-CXL`, contractorSerial: `${PREFIX}-CTR-01`, extractDate: new Date('2026-06-01'), totalValue: 10000, netWorkValue: 10000, isPosted: false, isCancelled: true, statement: 'ملغي للعرض', items: [{ itemName: 'بند ملغي', quantity: 1, unit: 'عدد', unitPrice: 10000, totalPrice: 10000 }] },
    ],
    payments: [
      { extractKey: 'posted1', paymentNumber: `${PREFIX}-PAY-01`, contractorSerial: `${PREFIX}-CTR-01`, paymentDate: new Date('2026-07-15'), paymentAmount: 100000, totalExtracts: 180000, totalPaid: 100000, isPosted: true, description: 'دفعة مرحّلة' },
      { extractKey: 'posted1', paymentNumber: `${PREFIX}-PAY-01B`, contractorSerial: `${PREFIX}-CTR-01`, paymentDate: new Date('2026-08-01'), paymentAmount: 50000, totalExtracts: 180000, totalPaid: 150000, isPosted: true, description: 'دفعة ثانية' },
      { extractKey: 'draft', paymentNumber: `${PREFIX}-PAY-02`, contractorSerial: `${PREFIX}-CTR-01`, paymentDate: new Date('2026-09-25'), dueDate: new Date('2026-10-05'), paymentAmount: 50000, totalExtracts: 135000, totalPaid: 0, isPosted: false, description: 'دفعة معلّقة' },
      { extractKey: 'self', paymentNumber: `${PREFIX}-PAY-03`, contractorSerial: `${PREFIX}-CTR-02`, paymentDate: new Date('2026-09-12'), paymentAmount: 40000, totalExtracts: 75000, totalPaid: 40000, isPosted: true, description: 'سداد تنفيذ ذاتي' },
    ],
    glAccountId: glAccount?.id,
  };

  const p2 = {
    serial: `${PREFIX}-EXT-P2`,
    project: {
      arabicName: 'مشروع تجريبي — مجمع الشرق',
      englishName: 'Demo East Compound',
      totalValue: new Decimal(3_200_000),
      advancePaymentPercentage: new Decimal(8),
      advancePaymentValue: new Decimal(256_000),
      notes: 'مشروع ثانٍ للتجربة والتقارير',
    },
    buildings: [{ unitNumber: 'V-01', groupNumber: 'V', modelNumber: 'Villa', arabicName: 'فيلا 1' }],
    workItems: AGENDA_GROUPS.map((g, i) => ({
      itemNumber: `P2-0${i + 1}`,
      buildingUnit: 'V-01',
      itemGroupName: g,
      arabicName: `بند ${g} — مجمع الشرق`,
      englishName: `Item ${i + 1}`,
      quantity: 100 + i * 50,
      unit: 'م2',
      unitPrice: 200 + i * 30,
      totalPrice: (100 + i * 50) * (200 + i * 30),
    })),
    contractors: [
      { serial: `${PREFIX}-CTR-03`, arabicName: 'مقاول تجريبي — الشرق', englishName: 'East Contractor', phone: '01000000003' },
    ],
    measurements: [
      { arabicName: 'عرض الشارع', unit: 'م' },
      { arabicName: 'مساحة الحديقة', unit: 'م2' },
    ],
    manpower: [
      { date: new Date('2026-09-08'), workerName: 'يوسف — عامل', workerType: 'unskilled', hours: 8, wage: 220 },
      { date: new Date('2026-09-09'), workerName: 'هشام — فني', workerType: 'skilled', hours: 8, wage: 360 },
    ],
    extracts: [
      { key: 'p2posted', extractNumber: `${PREFIX}-P2-001`, contractorSerial: `${PREFIX}-CTR-03`, extractDate: new Date('2026-09-01'), totalValue: 88000, netWorkValue: 88000, isPosted: true, items: [{ itemNumber: 'P2-01', quantity: 50, unit: 'م2', unitPrice: 200, totalPrice: 10000 }] },
      { key: 'p2draft', extractNumber: `${PREFIX}-P2-002`, contractorSerial: `${PREFIX}-CTR-03`, extractDate: new Date('2026-09-18'), totalValue: 45000, netWorkValue: 45000, isPosted: false, items: [{ itemNumber: 'P2-02', quantity: 80, unit: 'م2', unitPrice: 230, totalPrice: 18400 }] },
    ],
    payments: [
      { extractKey: 'p2posted', paymentNumber: `${PREFIX}-P2-PAY-1`, contractorSerial: `${PREFIX}-CTR-03`, paymentDate: new Date('2026-09-05'), paymentAmount: 30000, totalExtracts: 88000, totalPaid: 30000, isPosted: true },
    ],
    glAccountId: glAccount?.id,
  };

  const r1 = await seedProjectBundle(companyId, p1);
  const r2 = await seedProjectBundle(companyId, p2);

  const counts = {
    projects: await prisma.project.count({ where: { companyId, serial: { startsWith: PREFIX } } }),
    contractors: await prisma.contractor.count({ where: { companyId, serial: { startsWith: PREFIX } } }),
    workItems: await prisma.projectWorkItem.count({
      where: { project: { companyId, serial: { startsWith: PREFIX } } },
    }),
    buildings: await prisma.projectBuilding.count({
      where: { project: { companyId, serial: { startsWith: PREFIX } } },
    }),
    measurements: await prisma.projectMeasurementDefinition.count({
      where: { project: { companyId, serial: { startsWith: PREFIX } } },
    }),
    manpower: await prisma.manpowerLog.count({
      where: { project: { companyId, serial: { startsWith: PREFIX } } },
    }),
    extracts: await prisma.extract.count({
      where: { project: { companyId, serial: { startsWith: PREFIX } } },
    }),
    payments: await prisma.extractPayment.count({
      where: { project: { companyId, serial: { startsWith: PREFIX } } },
    }),
    assignments: await prisma.contractorAssignment.count({
      where: { project: { companyId, serial: { startsWith: PREFIX } } },
    }),
  };

  console.log(
    JSON.stringify(
      {
        ok: true,
        email: user.email,
        companyId,
        glAccountLinked: glAccount ? { id: glAccount.id, code: glAccount.code } : null,
        projects: {
          nile: { id: r1.project.id, serial: r1.project.serial },
          east: { id: r2.project.id, serial: r2.project.serial },
        },
        counts,
        pages: {
          dashboard: '/extracts',
          projects: '/extracts/operations/projects',
          agendaItems: `/extracts/operations/projects/agenda-items?projectId=${r1.project.id}`,
          maqaysa: `/extracts/operations/project-measurement-definition?projectId=${r1.project.id}`,
          generalItems: '/extracts/operations/general-extract-items',
          detailedItems: '/extracts/operations/detailed-extract-items',
          contractor: '/extracts/operations/contractor',
          contractorSettings: '/extracts/operations/extract-contractor-settings',
          extractPayment: '/extracts/operations/extract-payment',
          manpower: `/extracts/operations/manpower-log?projectId=${r1.project.id}`,
          reportPayments: '/extracts/reports/contractor-payments',
          reportProjectsStatus: '/extracts/reports/projects-status',
          reportInventory: '/extracts/reports/inventory',
          contractingEnterprise: '/contracting/projects',
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
