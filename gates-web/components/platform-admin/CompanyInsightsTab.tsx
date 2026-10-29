'use client';

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { FileCheck2, HardDrive, Plug, ShieldAlert, Users, GitBranch } from 'lucide-react';
import { useCompanyInsights } from '@/lib/platform-admin/hooks';
import { fmtBytes, fmtDate, fmtNum } from '@/lib/platform-admin/format';
import { Badge, Card, ErrorBox, Spinner, Stat, Table } from './ui';

const MONTH_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTH_AR[(m ?? 1) - 1]} ${String(y).slice(2)}`;
};

const SERIES_COLORS: Record<string, string> = {
  invoices: '#0E78AA',
  pos: '#22A06B',
  journal: '#7C5CDB',
  treasury: '#E0912F',
  stock: '#1BA3B8',
  payroll: '#D1495B',
  eInvoices: '#5B7183',
};

const ETA_LABEL: Record<string, string> = {
  DRAFT: 'مسودة',
  draft: 'مسودة',
  SUBMITTED: 'مُرسل',
  submitted: 'مُرسل',
  VALID: 'مقبول',
  ACCEPTED: 'مقبول',
  approved: 'مقبول',
  REJECTED: 'مرفوض',
  rejected: 'مرفوض',
  INVALID: 'غير صالح',
  CANCELLED: 'ملغي',
  cancelled: 'ملغي',
  FAILED: 'فشل',
  PENDING: 'قيد المعالجة',
};
const BAD = /REJECT|INVALID|FAIL|ERROR/i;

function StatusChips({ map }: { map: Record<string, number> }) {
  const entries = Object.entries(map);
  if (entries.length === 0) return <span className="text-xs text-slate-400">لا يوجد</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([status, n]) => (
        <Badge key={status} tone={BAD.test(status) ? 'red' : /VALID|ACCEPT|approved|SUBMIT/i.test(status) ? 'green' : 'gray'}>
          {ETA_LABEL[status] ?? status}: {fmtNum(n)}
        </Badge>
      ))}
    </div>
  );
}

function Meter({ used, max, label, icon }: { used: number; max: number | null; label: string; icon: React.ReactNode }) {
  const pct = max ? Math.min(100, Math.round((used / max) * 100)) : 0;
  return (
    <div className="rounded-2xl border border-[#E3EEF4] bg-white p-4">
      <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
        <span className="flex items-center gap-1.5">{icon}{label}</span>
        <span className="font-bold text-[#0A3D5E]">{max ? `${fmtNum(used)} / ${fmtNum(max)}` : `${fmtNum(used)} · بلا حد`}</span>
      </div>
      <div className="h-2 rounded-full bg-[#EEF4F8]">
        <div
          className={`h-2 rounded-full ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-[#0E78AA]'}`}
          style={{ width: `${max ? Math.max(2, pct) : 0}%` }}
        />
      </div>
    </div>
  );
}

export function CompanyInsightsTab({ companyId }: { companyId: string }) {
  const { data, isLoading, error } = useCompanyInsights(companyId);
  if (isLoading) return <Spinner />;
  if (error || !data) return <ErrorBox error={error} />;

  const chart = data.months.map((m, i) => {
    const row: Record<string, string | number> = { month: monthLabel(m) };
    for (const u of data.usage) row[u.key] = u.perMonth[i] ?? 0;
    return row;
  });
  const used = data.usage.filter((u) => u.total > 0);
  const storageMb = data.storage.usedBytes / 1024 ** 2;
  const etaBad =
    Object.entries({ ...data.eta.documents, ...data.eta.receipts }).filter(([s]) => BAD.test(s)).reduce((a, [, n]) => a + n, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Meter used={data.limits.users.used} max={data.limits.users.max} label="المستخدمون المفعّلون" icon={<Users className="h-3.5 w-3.5" />} />
        <Meter used={data.limits.branches.used} max={data.limits.branches.max} label="الفروع" icon={<GitBranch className="h-3.5 w-3.5" />} />
        <Meter used={Math.round(storageMb)} max={data.storage.limitMb} label="المساحة (م.ب)" icon={<HardDrive className="h-3.5 w-3.5" />} />
        <Stat
          label="مشاكل ترحيل الحسابات"
          value={fmtNum(data.integrity.glViolationsTotal)}
          hint={`${fmtNum(data.integrity.glViolationsLast30Days)} خلال 30 يوماً`}
          icon={<ShieldAlert className="h-5 w-5" />}
          tone={data.integrity.glViolationsTotal ? 'red' : 'green'}
        />
      </div>

      <Card title="استخدام الموديولات شهرياً" subtitle="عدد المستندات المنشأة في كل موديول — آخر 6 شهور">
        {used.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">لم تُنشئ الشركة أي مستندات خلال آخر 6 شهور</p>
        ) : (
          <>
            <div className="h-72" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF4F8" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {used.map((u) => (
                    <Bar key={u.key} dataKey={u.key} name={u.label} stackId="a" fill={SERIES_COLORS[u.key] ?? '#0E78AA'} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4">
              <Table head={['الموديول', ...data.months.map(monthLabel), 'الإجمالي']}>
                {data.usage.map((u) => (
                  <tr key={u.key} className={u.total === 0 ? 'text-slate-400' : ''}>
                    <td className="whitespace-nowrap px-4 py-2.5 font-semibold">{u.label}</td>
                    {u.perMonth.map((n, i) => (
                      <td key={i} className="px-4 py-2.5 text-xs tabular-nums">{n ? fmtNum(n) : '—'}</td>
                    ))}
                    <td className="px-4 py-2.5 text-xs font-bold tabular-nums">{fmtNum(u.total)}</td>
                  </tr>
                ))}
              </Table>
            </div>
          </>
        )}
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card
          title={<span className="flex items-center gap-2"><FileCheck2 className="h-4 w-4" /> الفاتورة الإلكترونية</span>}
          subtitle="حالة المستندات المرسلة لمنظومة الضرائب"
          actions={etaBad ? <Badge tone="red">{fmtNum(etaBad)} مرفوض/فاشل</Badge> : <Badge tone="green">لا مشاكل</Badge>}
        >
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="mb-1.5 text-xs font-semibold text-slate-500">الفواتير والإشعارات</dt>
              <dd><StatusChips map={data.eta.documents} /></dd>
            </div>
            <div>
              <dt className="mb-1.5 text-xs font-semibold text-slate-500">إيصالات نقاط البيع الإلكترونية</dt>
              <dd><StatusChips map={data.eta.receipts} /></dd>
            </div>
            <div>
              <dt className="mb-1.5 text-xs font-semibold text-slate-500">الفواتير الإلكترونية (النسخة القديمة)</dt>
              <dd><StatusChips map={data.eta.legacyInvoices} /></dd>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-2 border-t border-[#EEF4F8] pt-3 text-xs text-slate-600">
              <span>أجهزة التوقيع المفعّلة: <b className="text-[#0A3D5E]">{data.eta.activeSigningDevices}</b></span>
              <span>
                آخر مشكلة:{' '}
                <b className="text-[#0A3D5E]">
                  {data.eta.lastProblem ? `${ETA_LABEL[data.eta.lastProblem.status] ?? data.eta.lastProblem.status} · ${fmtDate(data.eta.lastProblem.createdAt)}` : 'لا يوجد'}
                </b>
              </span>
            </div>
          </dl>
        </Card>

        <Card title={<span className="flex items-center gap-2"><Plug className="h-4 w-4" /> التكاملات والملفات</span>}>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <Item k="واتساب" v={data.integrations.whatsapp === 'active' ? 'مفعّل' : data.integrations.whatsapp === 'configured' ? 'مُعد وموقوف' : 'غير مُعد'} />
            <Item k="البريد الإلكتروني" v={data.integrations.email === 'configured' ? 'مُعد' : 'غير مُعد'} />
            <Item k="مفاتيح API" v={fmtNum(data.integrations.apiKeys)} />
            <Item k="قواعد الأتمتة" v={fmtNum(data.integrations.automationRules)} />
            <Item k="مهام نقل البيانات القديمة" v={fmtNum(data.integrations.migrationJobs)} />
            <Item k="المرفقات" v={`${fmtNum(data.storage.files)} ملف · ${fmtBytes(data.storage.usedBytes)}`} />
          </dl>
        </Card>
      </div>
    </div>
  );
}

function Item({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{k}</dt>
      <dd className="mt-0.5 font-semibold text-[#0A3D5E]">{v}</dd>
    </div>
  );
}
