import { readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { tableGuide, labelColumn, explainColumn, explainRelation, DOMAIN_GUIDES } from './db-explorer-ar.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(resolve(root, '../prisma/schema.prisma'), 'utf8');
const jsonPath = resolve(root, '../docs/database-explorer.json');
const htmlPath = resolve(root, '../docs/database-explorer.html');
const indexPath = resolve(root, '../docs/database-explorer-index.txt');

function stripBlockComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '');
}

const cleaned = stripBlockComments(schema);
const SCALARS = new Set(['String', 'Boolean', 'Int', 'BigInt', 'Float', 'Decimal', 'DateTime', 'Json', 'Bytes']);

const enums = [];
const enumRe = /(?:^|\n)enum (\w+) \{([\s\S]*?)\n\}/g;
let enumMatch;
while ((enumMatch = enumRe.exec(cleaned))) {
  const values = enumMatch[2]
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//') && !l.startsWith('///'))
    .map((l) => l.replace(/,$/, '').split(/\s+/)[0]);
  enums.push({ name: enumMatch[1], values });
}
const ENUMS = new Set(enums.map((e) => e.name));

const modelRe = /(?:^|\n)((?:\/\/\/.*\n)*)model (\w+) \{([\s\S]*?)\n\}/g;
const models = [];
let match;

while ((match = modelRe.exec(cleaned))) {
  const docs = (match[1] || '')
    .split('\n')
    .map((l) => l.replace(/^\/\/\/\s?/, '').trim())
    .filter(Boolean);
  const name = match[2];
  const body = match[3];
  const tableMatch = body.match(/@@map\("([^"]+)"\)/);
  const table = tableMatch?.[1] || name;
  const fields = [];
  const uniques = [];
  const indexes = [];

  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('//') || line.startsWith('///')) continue;
    if (line.startsWith('@@')) {
      if (line.startsWith('@@unique') || line.startsWith('@@id')) uniques.push(line);
      if (line.startsWith('@@index')) indexes.push(line);
      continue;
    }
    const fieldMatch = line.match(/^(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*?)(?:\/\/\s*(.*))?$/);
    if (!fieldMatch) continue;
    const attrs = (fieldMatch[5] || '').trim();
    const baseType = fieldMatch[2];
    const isRelation =
      /@relation/.test(attrs) || (!SCALARS.has(baseType) && !ENUMS.has(baseType));
    fields.push({
      name: fieldMatch[1],
      type: fieldMatch[2] + (fieldMatch[3] || ''),
      optional: Boolean(fieldMatch[4]),
      isList: Boolean(fieldMatch[3]),
      isRelation,
      isEnum: ENUMS.has(baseType),
      relationName: attrs.match(/@relation\(\s*"([^"]+)"/)?.[1] || null,
      fkFields: attrs.match(/fields:\s*\[([^\]]+)\]/)?.[1]?.split(',').map((s) => s.trim()) || [],
      fkRefs: attrs.match(/references:\s*\[([^\]]+)\]/)?.[1]?.split(',').map((s) => s.trim()) || [],
      onDelete: attrs.match(/onDelete:\s*(\w+)/)?.[1] || null,
      isId: attrs.includes('@id'),
      isUnique: attrs.includes('@unique'),
      hasDefault: attrs.includes('@default'),
      comment: (fieldMatch[6] || '').trim() || null,
      attributes: attrs.replace(/\s+/g, ' ').trim(),
    });
  }

  models.push({ name, table, docs, fields, uniques, indexes });
}

const DOMAIN_RULES = [
  { id: 'legacy', ar: 'تراث قديم', test: /^(Tenant|UserLegacy|RateLimit)$/ },
  { id: 'core', ar: 'الشركة والفروع والإعدادات', test: /^(Company|Branch|CompanySetting|Fiscal|DocumentSequence|NewModule|OtherModule|DocumentProfile|TransactionSettings|SystemSetting|ApiKey|ActivityLog|SystemNotification|DocumentAttachment|DocumentLayout|TenantSubscription|Period$)/ },
  { id: 'users', ar: 'مستخدمين وصلاحيات', test: /^(User|UserGroup|UserPermission|UserAdvanced|UserBranch|BankBoxRight|UserTour)/ },
  { id: 'accounting', ar: 'محاسبة وقيود', test: /^(Account|CostCenter|Journal|RecurringJournal|AccountPeriod|PartnerRunning|GlPosting|Currency|ExchangeRate)/ },
  { id: 'parties', ar: 'أطراف (عميل/مورد/مندوب)', test: /^(Customer|Supplier|Delegate|Distributor|Driver|Person|Nationality|Religion|Marital|JobTitle|JobCadre|Department|City|Collector)/ },
  { id: 'treasury', ar: 'خزينة وبنوك وشيكات', test: /^(Bank|Safe|Treasury|CashTransaction|PaymentAllocation|Counterparty|Cheque|Securities|MultiCollection|Pos)/ },
  { id: 'inventory', ar: 'مخازن وأصناف', test: /^(Unit|Item|PriceList|Warehouse|Location|Clothing|OpeningStock|Stocktaking|Transfer|Assembly|Disassembly|Receipt|Issue|Adjustment|LandedCost|OtherAdjustment|InventoryMovement|SerialNumber|OtherAddition)/ },
  { id: 'sales', ar: 'بيع وشراء وفواتير', test: /^(Invoice|PurchaseOrder|PurchaseReturn|PriceQuote|ItemOffer|RepresentativeCommission)/ },
  { id: 'hr', ar: 'موارد بشرية', test: /^(Employee|HrSettings|Payroll|MonthlySalary|HousingAllowance|EndOfService|AnnualLeave|WagePolicy|Allowance|Deduction|MonthlySalaries|HousingAllowanceEntitlements|EndOfServiceDisbursement|AnnualLeaveEntitlements)/ },
  { id: 'mfg', ar: 'تصنيع', test: /^(Manufacturing|BillOfMaterials|BomLine|Production)/ },
  { id: 'contracting', ar: 'مقاولات ومستخلصات', test: /^(Contracting|ContractingProject|ProjectSubcontract|ClientExtract|Subcontractor|Subcontract|ProjectBoq|ProjectBOQ|BOQ|ContractExtract|MaterialReconciliation|SitePenalty|DirectExecution|ExecutiveMeasurement|FinancialAdjustment|ClientContract|ClientInvoice|SiteStock|ProjectLetter|LgAction|Extract|Contractor|ProjectMeasurement|ManpowerLog|Project$|ProjectBuilding|ProjectWorkItem)/ },
  { id: 'realestate', ar: 'عقارات', test: /^(RealEstate|Property|UnitContract|UnitInstallment|PostDated|UnitResale|UnitCancellation|Rental)/ },
  { id: 'schools', ar: 'مدارس', test: /^(School|AcademicGrade|Student|Stage|Semester)/ },
  { id: 'trade', ar: 'استيراد واعتمادات', test: /^(Documentary|LetterOf|TradeSettings|LcExpense|LcReceipt|GuaranteeLetter|WithholdingTax)/ },
  { id: 'tax', ar: 'ضرائب وإي-فاتورة', test: /^(Tax|ElectronicInvoice|EInvoice|SensorReading)/ },
  { id: 'ai', ar: 'ذكاء اصطناعي ونمو', test: /^(Ai|Growth|Whatsapp|CompanyWhatsapp)/ },
  { id: 'other', ar: 'أخرى', test: /./ },
];

function domainFor(name) {
  return DOMAIN_RULES.find((r) => r.test.test(name)) || DOMAIN_RULES[DOMAIN_RULES.length - 1];
}

const tables = models.map((m, i) => {
  const domain = domainFor(m.name);
  const guide = tableGuide(m.table, m.name);
  const columns = m.fields.filter((f) => !f.isRelation);
  const relations = m.fields.filter((f) => f.isRelation).map((f) => {
    const targetTable = models.find((x) => x.name === f.type.replace('[]', ''));
    const targetGuide = targetTable ? tableGuide(targetTable.table, targetTable.name) : null;
    const rel = {
      field: f.name,
      fieldAr: labelColumn(f.name),
      targetModel: f.type.replace('[]', ''),
      targetTitle: targetGuide?.title || f.type.replace('[]', ''),
      cardinality: f.isList ? '1-N' : f.optional ? 'N-0..1' : 'N-1',
      relationName: f.relationName,
      fkFields: f.fkFields,
      fkRefs: f.fkRefs,
      onDelete: f.onDelete,
    };
    rel.explainAr = explainRelation(rel, rel.targetTitle);
    return rel;
  });
  return {
    index: i + 1,
    model: m.name,
    table: m.table,
    titleAr: guide.title,
    aboutAr: guide.about,
    usageAr: guide.usage,
    screens: guide.screens,
    domainId: domain.id,
    domainAr: domain.ar,
    domainExplainAr: DOMAIN_GUIDES[domain.id] || '',
    docs: m.docs,
    columnCount: columns.length,
    relationCount: relations.length,
    columns: columns.map((f) => ({
      name: f.name,
      labelAr: labelColumn(f.name),
      explainAr: explainColumn(f.name, f.comment),
      type: f.type,
      optional: f.optional,
      isEnum: f.isEnum,
      isId: f.isId,
      isUnique: f.isUnique,
      hasDefault: f.hasDefault,
      comment: f.comment,
    })),
    relations,
    uniques: m.uniques,
    indexes: m.indexes,
  };
});

const payload = {
  generatedAt: new Date().toISOString(),
  source: 'gates-backend/prisma/schema.prisma',
  engine: 'MySQL + Prisma',
  tableCount: tables.length,
  columnCount: tables.reduce((n, t) => n + t.columnCount, 0),
  relationCount: tables.reduce((n, t) => n + t.relationCount, 0),
  enumCount: enums.length,
  domains: DOMAIN_RULES.map((d) => ({
    id: d.id,
    ar: d.ar,
    explainAr: DOMAIN_GUIDES[d.id] || '',
    tableCount: tables.filter((t) => t.domainId === d.id).length,
  })).filter((d) => d.tableCount > 0),
  enums,
  tables,
};

writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf8');

const mdPath = resolve(root, '../docs/DATABASE-GUIDE-FULL-AR.md');
const md = [
  '# دليل قاعدة بيانات GATES — شرح كل جدول وكل عمود',
  '',
  `مولَّد من الـ schema: **${tables.length} جدول · ${payload.columnCount} عمود · ${payload.relationCount} علاقة · ${enums.length} قائمة قيم**.`,
  '',
  'المستكشف التفاعلي: [`database-explorer.html`](./database-explorer.html)',
  '',
  '## كيف تقرأ الدليل',
  '',
  '- كل قسم مجال (محاسبة، مخازن…).',
  '- كل جدول صفحة: المعنى، الاستخدام، الشاشات، الأعمدة، العلاقات.',
  '- المستند التشغيلي غير القيد. الترحيل هو اللي يكتب في الدفاتر.',
  '',
  '## المجالات',
  '',
  ...payload.domains.map((d) => `- **${d.ar}** (${d.tableCount} جدول): ${d.explainAr}`),
  '',
  '## قوائم القيم (enums)',
  '',
  ...enums.map((e) => `- \`${e.name}\`: ${e.values.join(' · ')}`),
  '',
];
for (const d of payload.domains) {
  md.push(`## ${d.ar}`, '', d.explainAr, '');
  for (const t of tables.filter((x) => x.domainId === d.id)) {
    md.push(`### ${t.index}. ${t.titleAr} (\`${t.table}\`)`, '');
    md.push(`موديل: \`${t.model}\` · ${t.columnCount} عمود · ${t.relationCount} علاقة`, '');
    md.push(`**إيه الجدول؟** ${t.aboutAr}`, '');
    md.push(`**امتى بيتستخدم؟** ${t.usageAr}`, '');
    if (t.screens.length) md.push(`**الشاشات:** ${t.screens.join(' · ')}`, '');
    md.push('| بالعربي | العمود | النوع | الشرح |', '|---|---|---|---|');
    for (const c of t.columns) {
      md.push(`| ${c.labelAr} | \`${c.name}\` | ${c.type}${c.optional ? '?' : ''} | ${c.explainAr} |`);
    }
    md.push('');
    if (t.relations.length) {
      md.push('**العلاقات:**', '');
      for (const r of t.relations) {
        md.push(`- \`${r.cardinality}\` ${r.fieldAr} → ${r.targetTitle}: ${r.explainAr}`);
      }
      md.push('');
    }
  }
}
writeFileSync(mdPath, md.join('\n'), 'utf8');

const indexLines = [
  `GATES database explorer index — ${tables.length} tables / ${payload.columnCount} columns / ${payload.relationCount} relations / ${enums.length} enums`,
  '',
  ...tables.map((t) => `${String(t.index).padStart(3, '0')}  ${t.table.padEnd(42)}  ${(t.titleAr || t.model).padEnd(36)}  ${t.domainAr}  cols=${t.columnCount} rels=${t.relationCount}`),
];
writeFileSync(indexPath, indexLines.join('\n'), 'utf8');

const embedded = JSON.stringify(payload).replace(/</g, '\\u003c');
const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GATES Database Explorer — شرح كامل ${tables.length} جدول</title>
  <style>
    :root { --bg:#071820; --card:#0f2a36; --line:#1d4b5e; --ink:#e8f4f8; --muted:#8fb3c2; --acc:#2bb0d6; --warn:#f0c36a; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: "Segoe UI", Tahoma, sans-serif; background:var(--bg); color:var(--ink); }
    header { padding:16px 22px; border-bottom:1px solid var(--line); background:#0b222c; position:sticky; top:0; z-index:5; }
    h1 { margin:0 0 6px; font-size:22px; }
    h2 { margin:0 0 8px; font-size:26px; }
    h3 { margin:22px 0 8px; color:var(--acc); font-size:16px; }
    .stats { color:var(--muted); font-size:13px; line-height:1.6; }
    .tools { display:flex; gap:8px; flex-wrap:wrap; margin-top:12px; }
    input, select { background:#08202a; color:var(--ink); border:1px solid var(--line); border-radius:8px; padding:8px 10px; min-width:220px; }
    .layout { display:grid; grid-template-columns: 340px 1fr; min-height: calc(100vh - 132px); }
    .list { border-left:1px solid var(--line); overflow:auto; max-height: calc(100vh - 132px); }
    .item { padding:10px 14px; border-bottom:1px solid #123140; cursor:pointer; }
    .item:hover, .item.active { background:#123848; }
    .item b { display:block; }
    .item span { color:var(--muted); font-size:12px; }
    .detail { padding:20px 26px 48px; overflow:auto; max-height: calc(100vh - 132px); }
    table { width:100%; border-collapse:collapse; margin:8px 0 22px; }
    th, td { border-bottom:1px solid #163a48; text-align:right; padding:8px 8px; font-size:13px; vertical-align:top; }
    th { color:var(--acc); position:sticky; top:0; background:#0b222c; }
    .pill { display:inline-block; background:#16485a; color:#bfefff; border-radius:999px; padding:2px 8px; font-size:11px; margin-left:4px; }
    .box { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:14px 16px; margin:10px 0 16px; line-height:1.75; }
    .box p { margin:6px 0; }
    .howto { display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:10px; margin:12px 0 6px; }
    .howto .box { margin:0; }
    code { color:#9fe7ff; }
    .muted { color:var(--muted); }
    .col-name { white-space:nowrap; }
    .col-explain { color:#d5e8ef; }
    .rel { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:10px 12px; margin:8px 0; }
    a { color:var(--acc); cursor:pointer; }
    @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } .list, .detail { max-height:none; } }
  </style>
</head>
<body>
  <header>
    <h1>مستكشف قاعدة بيانات GATES — شرح كل جدول وعمود</h1>
    <div class="stats" id="stats"></div>
    <div class="tools">
      <input id="q" placeholder="ابحث عربي أو إنجليزي: فاتورة، عميل، journal، debit…" />
      <select id="domain"><option value="">كل المجالات</option></select>
      <button id="home" style="background:#16485a;color:#fff;border:0;border-radius:8px;padding:8px 12px;cursor:pointer">صفحة الشرح</button>
    </div>
  </header>
  <div class="layout">
    <aside class="list" id="list"></aside>
    <main class="detail" id="detail"></main>
  </div>
  <script>
    const DB = ${embedded};
    const listEl = document.getElementById('list');
    const detailEl = document.getElementById('detail');
    const qEl = document.getElementById('q');
    const domainEl = document.getElementById('domain');
    document.getElementById('stats').textContent =
      DB.tableCount + ' جدول · ' + DB.columnCount + ' عمود · ' + DB.relationCount + ' علاقة · ' + DB.enumCount + ' enum · المصدر: ' + DB.source;
    for (const d of DB.domains) {
      const o = document.createElement('option');
      o.value = d.id; o.textContent = d.ar + ' (' + d.tableCount + ')';
      domainEl.appendChild(o);
    }
    let selected = null;
    function esc(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }
    function filtered() {
      const q = qEl.value.trim().toLowerCase();
      const domain = domainEl.value;
      return DB.tables.filter((t) => {
        if (domain && t.domainId !== domain) return false;
        if (!q) return true;
        const blob = [
          t.table, t.model, t.titleAr, t.aboutAr, t.usageAr, t.domainAr, (t.screens||[]).join(' '),
          ...(t.columns||[]).flatMap((c)=>[c.name, c.labelAr, c.explainAr]),
          ...(t.relations||[]).flatMap((r)=>[r.targetModel, r.targetTitle, r.fieldAr])
        ].join(' ').toLowerCase();
        return blob.includes(q);
      });
    }
    function renderList() {
      const rows = filtered();
      listEl.innerHTML = rows.map((t) => (
        '<div class="item' + (t.table === selected ? ' active' : '') + '" data-table="' + t.table + '">' +
        '<b>' + t.index + '. ' + esc(t.titleAr || t.table) + '</b>' +
        '<span>' + esc(t.table) + ' · ' + esc(t.domainAr) + ' · ' + t.columnCount + ' عمود · ' + t.relationCount + ' علاقة</span>' +
        '</div>'
      )).join('') || '<div class="item">لا نتائج</div>';
    }
    function flags(c) {
      return [c.isId?'مفتاح أساسي':'' , c.isUnique?'فريد':'', c.optional?'اختياري':'إلزامي', c.isEnum?'قائمة قيم':'', c.hasDefault?'له افتراضي':''].filter(Boolean).join(' · ');
    }
    function renderHome() {
      selected = null;
      detailEl.innerHTML =
        '<h2>إزاي تقرأ المستكشف</h2>' +
        '<div class="box"><p>الملف ده مش توثيق ناقص: فيه <b>كل</b> جداول الـ schema (' + DB.tableCount + ' جدول). القائمة على اليمين هي صفحات الجداول. الصفحة دي شرح عام، وبعدين كل جدول له صفحة فيها معناه، الشاشات اللي بتفتحه، وكل عمود وعلاقة بالعربي.</p></div>' +
        '<div class="howto">' +
        '<div class="box"><b>1) البحث</b><p>اكتب بالعربي أو الإنجليزي: «فاتورة»، «شيك»، «debit»، «journal». البحث يدخل في اسم الجدول والشرح وأسماء الأعمدة.</p></div>' +
        '<div class="box"><b>2) فلتر المجال</b><p>اختار «محاسبة» أو «مخازن» عشان تقلل القائمة. كل مجال له جملة تحت بتقول هو مسؤول عن إيه.</p></div>' +
        '<div class="box"><b>3) صفحة الجدول</b><p>العنوان العربي + شرح إيه الجدول + امتى النظام بيستخدمه + الشاشات المقابلة في ERP.</p></div>' +
        '<div class="box"><b>4) الأعمدة</b><p>لكل عمود: الاسم التقني، الاسم العربي، النوع، هل إلزامي، وشرح كامل ليه موجود.</p></div>' +
        '<div class="box"><b>5) العلاقات</b><p>1-N يعني الأب له أبناء كثير. N-1 يعني الصف مربوط بأب واحد. اضغط اسم الجدول الهدف للانتقال.</p></div>' +
        '<div class="box"><b>6) الفكرة التشغيلية</b><p>المستند (فاتورة/سند/إذن) غير القيد. الترحيل يكتب قيد + أرصدة. المرحّل ما يتعدّلش فوقه؛ يتفك أو يتعكس.</p></div>' +
        '</div>' +
        '<h3>المجالات</h3>' +
        DB.domains.map((d) => '<div class="box"><b>' + esc(d.ar) + '</b> <span class="muted">(' + d.tableCount + ' جدول)</span><p>' + esc(d.explainAr || '') + '</p></div>').join('') +
        '<h3>قوائم القيم (enums)</h3>' +
        '<div class="box">' + DB.enums.map((e) => '<p><code>' + esc(e.name) + '</code>: ' + esc((e.values||[]).join(' · ')) + '</p>').join('') + '</div>';
      renderList();
    }
    function renderDetail(table) {
      const t = DB.tables.find((x) => x.table === table);
      if (!t) return renderHome();
      selected = t.table;
      const screens = (t.screens && t.screens.length)
        ? t.screens.map((s) => '<span class="pill">' + esc(s) + '</span>').join(' ')
        : '<span class="muted">مش شاشة قائمة بذاتها — خدمة خلفية أو سطور داخل شاشة الرأس.</span>';
      detailEl.innerHTML =
        '<div class="muted">#' + t.index + ' · ' + esc(t.domainAr) + ' · موديل <code>' + esc(t.model) + '</code> · جدول <code>' + esc(t.table) + '</code></div>' +
        '<h2>' + esc(t.titleAr || t.table) + '</h2>' +
        '<div class="box"><p>' + esc(t.domainExplainAr || '') + '</p><p><b>إيه الجدول؟</b> ' + esc(t.aboutAr || '') + '</p><p><b>امتى النظام بيستخدمه؟</b> ' + esc(t.usageAr || '') + '</p><p><b>الشاشات:</b> ' + screens + '</p>' +
        (t.docs && t.docs.length ? '<p class="muted">تعليق الـ schema: ' + esc(t.docs.join(' ')) + '</p>' : '') +
        '</div>' +
        '<h3>الأعمدة (' + t.columnCount + ')</h3>' +
        '<table><thead><tr><th>بالعربي</th><th>العمود</th><th>النوع</th><th>الخصائص</th><th>الشرح الكامل</th></tr></thead><tbody>' +
        t.columns.map((c) => '<tr><td class="col-name"><b>' + esc(c.labelAr || c.name) + '</b></td><td><code>' + esc(c.name) + '</code></td><td>' + esc(c.type) + (c.optional ? '?' : '') +
          '</td><td class="muted">' + esc(flags(c)) + '</td><td class="col-explain">' + esc(c.explainAr || '') + '</td></tr>').join('') +
        '</tbody></table>' +
        '<h3>العلاقات (' + t.relationCount + ')</h3>' +
        (t.relations.length
          ? t.relations.map((r) => '<div class="rel"><span class="pill">' + esc(r.cardinality) + '</span> <b>' + esc(r.fieldAr || r.field) + '</b> → <a data-jump="' + esc(r.targetModel) + '">' + esc(r.targetTitle || r.targetModel) + '</a>' +
            '<div class="muted">' + esc(r.explainAr || '') +
            (r.fkFields && r.fkFields.length ? ' · المفتاح: ' + esc(r.fkFields.join(', ')) + ' → ' + esc((r.fkRefs||[]).join(', ')) : '') +
            (r.onDelete ? ' · عند الحذف: ' + esc(r.onDelete) : '') + '</div></div>').join('')
          : '<p class="stats">لا علاقات ظاهرة على الموديل.</p>') +
        (t.uniques.length ? '<p class="stats">قيود فريدة: <code>' + esc(t.uniques.join(' · ')) + '</code></p>' : '') +
        (t.indexes.length ? '<p class="stats">فهارس: <code>' + esc(t.indexes.join(' · ')) + '</code></p>' : '');
      renderList();
    }
    listEl.addEventListener('click', (e) => {
      const item = e.target.closest('.item');
      if (item && item.dataset.table) renderDetail(item.dataset.table);
    });
    detailEl.addEventListener('click', (e) => {
      const a = e.target.closest('[data-jump]');
      if (!a) return;
      const model = a.getAttribute('data-jump');
      const t = DB.tables.find((x) => x.model === model || x.table === model);
      if (t) renderDetail(t.table);
    });
    qEl.addEventListener('input', () => { renderList(); });
    domainEl.addEventListener('change', () => { renderList(); });
    document.getElementById('home').addEventListener('click', renderHome);
    renderHome();
  </script>
</body>
</html>`;

writeFileSync(htmlPath, html, 'utf8');
console.log(JSON.stringify({
  tables: tables.length,
  columns: payload.columnCount,
  relations: payload.relationCount,
  enums: enums.length,
  json: jsonPath,
  html: htmlPath,
  index: indexPath,
  md: resolve(root, '../docs/DATABASE-GUIDE-FULL-AR.md'),
}, null, 2));
