'use client';
import { AccountingSettingsPageHeader } from '@/components/accounting-settings';

import { useEffect, useRef, useState } from 'react';
import { parseMssqlConnectionString, normalizeSqlHostPort } from '@/lib/migration/parse-mssql-connection-string';
import OuterCard from '@/components/OuterCard';
import InnerCard from '@/components/InnerCard';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import MigrationPipelineVisual from '@/components/settings/migration/MigrationPipelineVisual';
import MigrationPaginatedReportTable, {
  FIELD_COVERAGE_COLUMNS,
  JOB_ISSUE_COLUMNS,
  MIGRATION_REPORT_PAGE_SIZE,
  SCHEMA_TABLE_COLUMNS,
} from '@/components/settings/migration/MigrationPaginatedReportTable';
import {
  uploadMigrationPackage,
  type MigrationUploadProgress,
} from '@/lib/migration/chunked-package-upload';
import MigrationPackageUploadProgress from '@/components/settings/migration/MigrationPackageUploadProgress';
import { useMigrationProgressStream } from '@/lib/migration/useMigrationProgressStream';
import type {
  MigrationCapabilities,
  MigrationJobRow,
  MigrationLifecycleState,
  MigrationPackageRow,
  MigrationProgressSnapshot,
} from '@/lib/migration/migration-types';
import {
  blockedModuleLabelAr,
  coreCoverageGapAr,
  explainMigrationEngineAlert,
  supportedLegacyEngineAr,
} from '@/lib/migration/capability-messages';
import { formatApiErrorMessage } from '@/lib/api/format-api-error';
import { apiClient } from '@/lib/api/client';
import type { ApiError } from '@/lib/api/types';
import { downloadMigrationAgent, pairingApiFromWindow } from '@/lib/migration/download-agent';

type WizardStep = 'source' | 'target' | 'preflight' | 'mapping' | 'run' | 'results';

export default function DatabaseMigrationPage() {
  useBackendReachability();

  const [step, setStep] = useState<WizardStep>('source');
  const [legacyCode, setLegacyCode] = useState('0001');
  const [sourceMode, setSourceMode] = useState<
    'REMOTE_SQL_SERVER' | 'ON_PREMISE_CONNECTOR' | 'BACKUP_RESTORE'
  >('REMOTE_SQL_SERVER');
  const [remoteHost, setRemoteHost] = useState('');
  const [remotePort, setRemotePort] = useState('1433');
  const [remoteDb, setRemoteDb] = useState('');
  const [remoteUser, setRemoteUser] = useState('');
  const [remotePassword, setRemotePassword] = useState('');
  const [selectedPackageId, setSelectedPackageId] = useState<string>('');
  const [lastUploadedPackage, setLastUploadedPackage] = useState<MigrationPackageRow | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [confirmWrite, setConfirmWrite] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadProgress, setUploadProgress] = useState<MigrationUploadProgress | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [liveProgress, setLiveProgress] = useState<MigrationProgressSnapshot | null>(null);
  const [operatorView, setOperatorView] = useState(true);
  const [showAlternateSources, setShowAlternateSources] = useState(false);
  const [showTechnicalRun, setShowTechnicalRun] = useState(false);
  const [autoPending, setAutoPending] = useState(false);
  const autoOpenedResults = useRef(false);
  const invalidate = useInvalidateQuery();

  const migrationQueryOpts = { skipErrorNotify: true as const };

  const { data: capsRes } = useApiQuery<MigrationCapabilities>(
    ['migration-engine', 'capabilities'],
    '/migration-engine/capabilities',
    undefined,
    migrationQueryOpts
  );
  const caps = capsRes?.data;

  const { data: jobsRes } = useApiQuery<MigrationJobRow[]>(
    ['migration-engine', 'jobs'],
    '/migration-engine/jobs',
    undefined,
    migrationQueryOpts
  );
  const jobs = jobsRes?.data ?? [];

  const { data: packagesRes, refetch: refetchPackages } = useApiQuery<MigrationPackageRow[]>(
    ['migration-engine', 'packages'],
    '/migration-engine/packages',
    undefined,
    migrationQueryOpts
  );
  const packagesFromApi = packagesRes?.data ?? [];
  const packages = (() => {
    const map = new Map<string, MigrationPackageRow>();
    for (const p of packagesFromApi) map.set(p.id, p);
    if (lastUploadedPackage) map.set(lastUploadedPackage.id, lastUploadedPackage);
    return [...map.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  })();

  const { data: jobDetailRes, refetch: refetchJobDetail } = useApiQuery<{
    progress: MigrationProgressSnapshot;
    job: MigrationJobRow;
  }>(
    ['migration-engine', 'job', activeJobId],
    `/migration-engine/jobs/${activeJobId ?? 'none'}`,
    undefined,
    { enabled: Boolean(activeJobId), ...migrationQueryOpts }
  );

  const streamEnabled = step === 'run' && Boolean(activeJobId);
  const { progress: streamProgress } = useMigrationProgressStream(activeJobId, streamEnabled);

  useEffect(() => {
    if (streamProgress) setLiveProgress(streamProgress);
    else if (jobDetailRes?.data?.progress) setLiveProgress(jobDetailRes.data.progress);
  }, [jobDetailRes, streamProgress]);

  useEffect(() => {
    if (!liveProgress) return;
    const terminal = ['COMPLETED', 'BLOCKED', 'FAILED'].includes(liveProgress.status);
    if (!terminal) {
      autoOpenedResults.current = false;
      return;
    }
    if (step === 'run' && !autoOpenedResults.current) {
      autoOpenedResults.current = true;
      setStep('results');
    }
  }, [liveProgress, step]);

  const createJobMutation = useApiMutation<MigrationJobRow, Record<string, unknown>>(
    '/migration-engine/jobs',
    'POST',
    {
      showSuccessToast: false,
      skipErrorNotify: true,
      onSuccess: (res) => {
        const id = res?.data?.id;
        if (id) setActiveJobId(id);
        setError('');
        setSuccess('تم إنشاء مهمة الترحيل');
        invalidate(['migration-engine']);
        setStep(operatorView ? 'run' : 'preflight');
      },
      onError: (e) => {
        setSuccess('');
        setError(formatApiErrorMessage(e as Error & ApiError) || 'فشل إنشاء المهمة');
      },
    }
  );

  const runMutation = useApiMutation<unknown, Record<string, unknown>>(
    activeJobId ? `/migration-engine/jobs/${activeJobId}/run` : '/migration-engine/jobs',
    'POST',
    {
      showSuccessToast: false,
      skipErrorNotify: true,
      onSuccess: () => {
        setError('');
        setSuccess('تم جدولة التشغيل');
        setStep('run');
        refetchJobDetail();
      },
      onError: (e) => {
        setSuccess('');
        setError(formatApiErrorMessage(e as Error & ApiError) || 'فشل التشغيل');
      },
    }
  );

  useEffect(() => {
    if (!activeJobId && jobs[0]?.id) setActiveJobId(jobs[0].id);
  }, [jobs, activeJobId]);

  const onUpload = async (file: File) => {
    if (isUploading) return;
    setError('');
    setSuccess('');
    setIsUploading(true);
    setUploadProgress({
      percent: 0,
      phase: 'init',
      uploadedBytes: 0,
      totalBytes: file.size,
      fileName: file.name,
    });
    try {
      const pkg = await uploadMigrationPackage(file, (p) => setUploadProgress(p));
      if (!pkg?.id) throw new Error('الخادم لم يرجع معرّف الحزمة — أعد الرفع');
      setSuccess(`تم رفع النسخة: ${pkg.originalName}`);
      setLastUploadedPackage(pkg);
      setSelectedPackageId(pkg.id);
      setSourceMode('BACKUP_RESTORE');
      await refetchPackages();
      window.setTimeout(() => setUploadProgress(null), 2500);
    } catch (e: unknown) {
      setUploadProgress(null);
      setError(formatApiErrorMessage(e as Error & ApiError) || (e instanceof Error ? e.message : 'فشل الرفع'));
    } finally {
      setIsUploading(false);
    }
  };

  const jobStatus = jobDetailRes?.data?.job?.status ?? jobs.find((j) => j.id === activeJobId)?.status;
  const jobNeedsRecreate = !activeJobId || ['COMPLETED', 'BLOCKED', 'FAILED', 'ROLLED_BACK'].includes(jobStatus ?? '');
  const runBusy = ['ANALYZING', 'DRY_RUNNING', 'RUNNING', 'RECONCILING'].includes(
    liveProgress?.status ?? jobStatus ?? ''
  );

  const startAutoCutover = async () => {
    if (!caps?.customerExecuteEnabled) {
      setError(
        'تنفيذ الترحيل غير مفعّل على هذه البيئة. يمكنك تحليل المصدر ومعاينته. الكتابة على بيانات الشركة تحتاج حساب اختبار داخلي وهدف غير إنتاجي.'
      );
      return;
    }
    if (!confirmWrite) {
      setError('فعّل «أؤكد الكتابة على بيانات الشركة الهدف» ثم اضغط ترحيل الآن.');
      return;
    }
    if (sourceMode === 'BACKUP_RESTORE' && !selectedPackageId && jobNeedsRecreate) {
      setError('اختر حزمة .bak بعد الرفع (أو انتظر حتى يكتمل الرفع).');
      return;
    }
    setError('');
    setSuccess('');
    setAutoPending(true);
    try {
      let jobId = jobNeedsRecreate ? null : activeJobId;
      if (!jobId) {
        const created = await createJobMutation.mutateAsync({
          legacyCompanyCode: legacyCode.trim(),
          sourceMode,
          ...(sourceMode === 'BACKUP_RESTORE' && selectedPackageId
            ? { packageId: selectedPackageId }
            : {}),
        });
        jobId = created?.data?.id ?? null;
        if (jobId) setActiveJobId(jobId);
      }
      if (!jobId) throw new Error('تعذّر إنشاء مهمة الترحيل');
      await apiClient.post(
        `/migration-engine/jobs/${jobId}/run`,
        { mode: 'auto', confirmTargetWrite: true },
        { skipSuccessNotify: true, skipErrorNotify: true }
      );
      setSuccess('بدأ الترحيل — التحليل ثم المعاينة ثم التنفيذ. اترك الصفحة مفتوحة.');
      setStep('run');
      setLiveProgress((prev) =>
        prev
          ? {
              ...prev,
              ui: {
                ...(prev.ui ?? {}),
                lastEnqueuedAt: new Date().toISOString(),
                lastError: null,
              },
            }
          : prev
      );
      invalidate(['migration-engine']);
      void refetchJobDetail();
    } catch (e) {
      setSuccess('');
      setError(formatApiErrorMessage(e as Error & ApiError) || 'فشل التشغيل');
    } finally {
      setAutoPending(false);
    }
  };

  const engineReady = caps?.engineEnabled && caps?.targetSafe;
  const sourceReady =
    sourceMode === 'BACKUP_RESTORE'
      ? Boolean(selectedPackageId)
      : caps?.legacyForensicConfigured === true || caps?.legacyRemoteSqlStatus === 'READY';
  const autoBusy = autoPending || createJobMutation.isPending || runMutation.isPending;

  const stepBtn = (id: WizardStep, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setStep(id)}
      className={`rounded-lg px-3 py-1.5 text-sm ${
        step === id ? 'bg-[#0E78AA] text-white' : 'border border-slate-200 bg-white text-slate-700'
      }`}
    >
      {label}
    </button>
  );

  return (
    <>
      <AccountingSettingsPageHeader title="ترحيل قواعد البيانات" />

      <div className="mb-4 rounded-lg border border-[#0E78AA]/30 bg-[#0E78AA]/5 px-4 py-3 text-sm text-slate-800 dark:text-slate-200">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-[#0A3D5E]">ترحيل من النظام القديم — مسار مختصر</p>
            {operatorView ? (
              <ol className="mt-2 list-decimal space-y-1 pr-5 text-slate-700 dark:text-slate-300">
                <li>
                  ارفع ملف .bak من هذه الشاشة. الاستعادة تتم على SQL Server معزول في السحابة — لا تثبّت SSMS على جهازك.
                  إن ظهرت رسالة أن خدمة الاستعادة غير جاهزة، الخادم لم يُربط بعد بـ SQL المعزول.
                  أو استخدم «الترحيل من جهازي» واترك نافذة البرنامج مفتوحة بعد بيانات SQL.
                </li>
                <li>
                  {caps?.customerExecuteEnabled === false
                    ? 'بعد إنشاء المهمة اضغط «تحليل المصدر». سيّب برنامج ويندوز مفتوح. «ترحيل الآن» مقفول على هذه البيئة ولن يكتب على بيانات الشركة.'
                    : 'فعّل «أؤكد الكتابة» واضغط «ترحيل الآن» — التحليل والمعاينة والتنفيذ يجرون تلقائياً.'}
                </li>
                <li>من «النتيجة» اضغط «تفعيل الشركة بعد الترحيل» إن لم تظهر محظورات حمراء.</li>
              </ol>
            ) : (
              <p className="mt-1 text-xs text-slate-600">
                الوضع التقني: فحص تغطية، ربط حسابات، تحليل ومعاينة جافة منفصلة.
              </p>
            )}
          </div>
          <label className="flex shrink-0 items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={!operatorView}
              onChange={(e) => setOperatorView(!e.target.checked)}
            />
            عرض تفاصيل تقنية (للفريق المتخصص)
          </label>
        </div>
      </div>

      {!engineReady && caps ? (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {explainMigrationEngineAlert(caps.message)}
        </p>
      ) : null}

      {engineReady && caps && caps.legacyForensicConfigured === false ? (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {caps.legacyRemoteSqlStatus === 'DRAFT' ? (
            <>
              تم حفظ بيانات SQL — اضغط{' '}
              <span className="font-semibold">«اختبار الاتصال»</span> حتى يصبح المصدر READY، ثم أنشئ
              المهمة.
            </>
          ) : caps.legacyRemoteSqlStatus === 'FAILED' ? (
            <>
              آخر اختبار اتصال فشل. راجع Host وكلمة المرور وخيار Trust server certificate ثم{' '}
              <span className="font-semibold">«اختبار الاتصال»</span> مرة أخرى.
            </>
          ) : (
            <>
              لم يُضبط مصدر Legacy بعد. اختر{' '}
              <span className="font-semibold">«اتصال SQL مباشر (Legacy / Forensic)»</span> أدناه وأدخل
              بيانات السيرفر (أو الصق connection string) ثم «حفظ الاتصال» و«اختبار الاتصال» قبل إنشاء
              المهمة. بديلاً: موصل داخل الشركة أو مسار .bak مع استعادة على SQL معزول.
            </>
          )}
        </p>
      ) : null}

      <OuterCard>
        <InnerCard>
          <div className="space-y-6 p-4">
            <div className="flex flex-wrap gap-2">
              {operatorView ? (
                <>
                  {stepBtn('source', '١ — الاتصال')}
                  {stepBtn('run', '٢ — التشغيل')}
                  {stepBtn('results', '٣ — النتيجة')}
                </>
              ) : (
                <>
                  {stepBtn('source', '1 — المصدر')}
                  {stepBtn('preflight', '2 — فحص')}
                  {stepBtn('mapping', '3 — الربط')}
                  {stepBtn('run', '4 — التنفيذ')}
                  {stepBtn('results', '5 — النتائج')}
                </>
              )}
            </div>

            {step === 'source' && (
              <div className="space-y-4">
                <h2 className="font-bold text-[#0A3D5E]">المصدر والمهمة</h2>
                <label className="block text-sm">
                  <span className="font-semibold text-slate-700">كود الشركة في النظام القديم</span>
                  <input
                    className="mt-1 h-10 w-full max-w-xs rounded-lg border border-slate-200 px-3"
                    value={legacyCode}
                    onChange={(e) => setLegacyCode(e.target.value)}
                  />
                </label>
                <p className="text-sm text-slate-600">
                  مسار العميل: ارفع .bak. الخادم يستعيده على SQL Server معزول ثم يرحّل إلى شركة Gates.
                  «اتصال SQL مباشر» يبقى للسيرفرات التي تملكها أنت بالفعل. حجم الرفع محدود بـ MIGRATION_UPLOAD_MAX_MB (الافتراضي 4096).
                </p>
                {operatorView && !showAlternateSources ? (
                  <button
                    type="button"
                    className="text-xs text-[#0E78AA] underline"
                    onClick={() => setShowAlternateSources(true)}
                  >
                    طرق أخرى (موصل داخل الشركة أو ملف .bak)
                  </button>
                ) : null}
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={sourceMode === 'REMOTE_SQL_SERVER'}
                      onChange={() => setSourceMode('REMOTE_SQL_SERVER')}
                    />
                    اتصال SQL مباشر (Legacy / Forensic)
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={sourceMode === 'ON_PREMISE_CONNECTOR'}
                      onChange={() => setSourceMode('ON_PREMISE_CONNECTOR')}
                    />
                    الترحيل من جهازي
                  </label>
                  {(!operatorView || showAlternateSources) && (
                    <>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={sourceMode === 'BACKUP_RESTORE'}
                          onChange={() => setSourceMode('BACKUP_RESTORE')}
                        />
                        رفع نسخة احتياطية (.bak)
                      </label>
                    </>
                  )}
                </div>
                {sourceMode === 'REMOTE_SQL_SERVER' && (
                  <RemoteSqlSourcePanel
                    legacyCompanyCode={legacyCode.trim() || '0001'}
                    host={remoteHost}
                    port={remotePort}
                    database={remoteDb}
                    user={remoteUser}
                    password={remotePassword}
                    onChange={(p) => {
                      if (p.host != null) setRemoteHost(p.host);
                      if (p.port != null) setRemotePort(p.port);
                      if (p.database != null) setRemoteDb(p.database);
                      if (p.user != null) setRemoteUser(p.user);
                      if (p.password != null) setRemotePassword(p.password);
                    }}
                    onSuccess={(m) => {
                      setError('');
                      setSuccess(m ?? 'تم حفظ واختبار اتصال SQL');
                    }}
                    onError={(m) => {
                      setSuccess('');
                      setError(m);
                    }}
                  />
                )}
                {sourceMode === 'ON_PREMISE_CONNECTOR' && (
                  <ConnectorSourcePanel
                    caps={caps}
                    onError={(m) => setError(m)}
                    onSuccess={(m) => setSuccess(m)}
                  />
                )}
                {sourceMode === 'BACKUP_RESTORE' && (
                  <div className="space-y-3 max-w-xl">
                    <input
                      type="file"
                      accept=".bak,.zip,.7z"
                      disabled={isUploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void onUpload(f);
                        e.target.value = '';
                      }}
                    />
                    {uploadProgress ? <MigrationPackageUploadProgress progress={uploadProgress} /> : null}
                    {packages.length === 0 ? (
                      <p className="text-xs text-amber-800">
                        لا توجد حزم بعد — ارفع ملف .bak وانتظر اكتمال شريط الرفع، ثم ستُختار الحزمة تلقائياً.
                      </p>
                    ) : null}
                    <select
                      className="h-10 w-full rounded-lg border border-slate-200 px-2 text-sm"
                      value={selectedPackageId}
                      onChange={(e) => setSelectedPackageId(e.target.value)}
                    >
                      <option value="">— اختر حزمة —</option>
                      {packages.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.originalName} ({Math.round(p.sizeBytes / 1024 / 1024)} MB)
                        </option>
                      ))}
                    </select>
                    {selectedPackageId ? (
                      <p className="text-[11px] text-slate-500 break-all">معرّف الحزمة: {selectedPackageId}</p>
                    ) : null}
                    {caps?.bakRestoreAutoReady === false || caps?.bakRestoreAutoReady == null ? (
                      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">
                        استعادة .bak على هذا الخادم غير جاهزة: لا يوجد SQL Server معزول (أو sqlcmd) يقبل الاستعادة.
                        المطلوب خدمة restore منفصلة عن MySQL — ليست تثبيت SQL على جهاز العميل.
                        إلى أن تُفعَّل، «اتصال SQL مباشر» يظل مسار المشغّل فقط.
                      </p>
                    ) : selectedPackageId ? (
                      <PackageRestoreAssessment packageId={selectedPackageId} />
                    ) : null}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  {operatorView ? (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={confirmWrite}
                        onChange={(e) => setConfirmWrite(e.target.checked)}
                      />
                      أؤكد الكتابة على بيانات الشركة الهدف
                    </label>
                  ) : null}
                  {operatorView ? (
                    <button
                      type="button"
                      className="rounded-lg bg-[#0E78AA] px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
                      disabled={
                        !engineReady ||
                        !sourceReady ||
                        !confirmWrite ||
                        autoBusy ||
                        isUploading ||
                        !caps?.customerExecuteEnabled ||
                        (sourceMode === 'BACKUP_RESTORE' && !selectedPackageId)
                      }
                      onClick={() => void startAutoCutover()}
                    >
                      {autoBusy ? 'جاري الترحيل…' : 'ترحيل الآن'}
                    </button>
                  ) : null}
                  {operatorView && caps?.customerExecuteEnabled === false ? (
                    <p className="w-full text-xs text-amber-800">
                      التنفيذ على بيانات الشركة متوقف حتى يُفعَّل اختبار داخلي على هدف غير إنتاجي. التحليل والمعاينة متاحان بعد ربط المصدر.
                    </p>
                  ) : null}
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 disabled:opacity-50"
                    disabled={
                      !engineReady ||
                      createJobMutation.isPending ||
                      isUploading ||
                      (sourceMode === 'BACKUP_RESTORE' && !selectedPackageId)
                    }
                    onClick={() => {
                      if (sourceMode === 'BACKUP_RESTORE' && !selectedPackageId) {
                        setError('اختر حزمة .bak بعد الرفع (أو انتظر حتى يكتمل الرفع).');
                        return;
                      }
                      if (sourceMode === 'ON_PREMISE_CONNECTOR') {
                        setError('');
                      }
                      createJobMutation.mutate({
                        legacyCompanyCode: legacyCode.trim(),
                        sourceMode,
                        ...(sourceMode === 'BACKUP_RESTORE' && selectedPackageId
                          ? { packageId: selectedPackageId }
                          : {}),
                      });
                    }}
                  >
                    {createJobMutation.isPending ? 'جاري إنشاء المهمة…' : 'إنشاء مهمة ترحيل'}
                  </button>
                  {jobs[0]?.id ? (
                    <span className="text-xs text-slate-500">آخر مهمة: {jobs[0].id.slice(0, 8)}…</span>
                  ) : null}
                  {sourceMode === 'ON_PREMISE_CONNECTOR' ? (
                    <p className="w-full text-xs text-amber-800">
                      إنشاء المهمة لا يتصل بـ SQL من المتصفح. لازم نافذة البرنامج على ويندوز تفضل مفتوحة بعد بيانات SQL.
                    </p>
                  ) : null}
                  {operatorView && engineReady && !sourceReady ? (
                    <p className="w-full text-xs text-amber-800">
                      اختبر اتصال SQL أولاً حتى يصبح المصدر READY، ثم «ترحيل الآن».
                    </p>
                  ) : null}
                </div>
              </div>
            )}

            {!operatorView && (step === 'preflight' || step === 'target') && activeJobId && (
              <CoreCoveragePanel jobId={activeJobId} variant="full" />
            )}

            {!operatorView && step === 'mapping' && activeJobId && (
              <MappingPanel jobId={activeJobId} onContinue={() => setStep('run')} />
            )}

            {step === 'run' && activeJobId && (
              <div className="space-y-4">
                <h2 className="font-bold text-[#0A3D5E]">{operatorView ? 'تشغيل الترحيل' : 'التنفيذ'}</h2>
                {operatorView ? (
                  <CoreCoveragePanel jobId={activeJobId} variant="operator" />
                ) : null}
                <JobControlBar
                  jobId={activeJobId}
                  status={liveProgress?.status}
                  onAborted={() => {
                    setError('');
                    setSuccess('تم إيقاف التشغيل. يمكنك التحليل أو المعاينة من جديد.');
                    setStep('run');
                    autoOpenedResults.current = false;
                    invalidate(['migration-engine']);
                    void refetchJobDetail();
                  }}
                  onAbortError={(m) => {
                    setSuccess('');
                    setError(m);
                  }}
                />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={confirmWrite} onChange={(e) => setConfirmWrite(e.target.checked)} />
                  أؤكد الكتابة على بيانات الشركة الهدف
                </label>
                {operatorView ? (
                  <div className="space-y-3">
                    {caps?.customerExecuteEnabled === false ? (
                      <>
                        <p className="text-sm text-amber-900">
                          التنفيذ على بيانات الشركة مقفول هنا. في الخطوة دي اضغط «تحليل» فقط، وسيّب نافذة البرنامج على ويندوز مفتوحة.
                          «ترحيل الآن» مش هيكتب على الشركة في البيئة الحالية.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded-lg bg-[#0E78AA] px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
                            disabled={runMutation.isPending || runBusy}
                            onClick={() => runMutation.mutate({ mode: 'analyze' })}
                          >
                            {runMutation.isPending ? 'جاري التحليل…' : 'تحليل المصدر'}
                          </button>
                          <button
                            type="button"
                            className="rounded border px-3 py-2 text-sm disabled:opacity-50"
                            disabled={runMutation.isPending || runBusy}
                            onClick={() => runMutation.mutate({ mode: 'dry-run' })}
                          >
                            معاينة جافة
                          </button>
                        </div>
                        {runBusy ? (
                          <p className="text-xs text-amber-800">
                            التشغيل واقف عند {liveProgress?.overallPercent ?? '—'}%. اضغط «إيقاف التشغيل» لو حابب توقفه وتعيد التحليل أو المعاينة.
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="rounded-lg bg-[#0E78AA] px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
                          disabled={!sourceReady || !confirmWrite || autoBusy}
                          onClick={() => void startAutoCutover()}
                        >
                          {autoBusy ? 'جاري الترحيل…' : 'ترحيل الآن'}
                        </button>
                        <button
                          type="button"
                          className="block text-xs text-slate-500 underline"
                          onClick={() => setShowTechnicalRun((v) => !v)}
                        >
                          {showTechnicalRun ? 'إخفاء تحليل/معاينة' : 'تحليل أو معاينة جافة (اختياري)'}
                        </button>
                        {showTechnicalRun ? (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="rounded border px-3 py-2 text-sm disabled:opacity-50"
                              disabled={runMutation.isPending || runBusy}
                              onClick={() => runMutation.mutate({ mode: 'analyze' })}
                            >
                              تحليل
                            </button>
                            <button
                              type="button"
                              className="rounded border px-3 py-2 text-sm disabled:opacity-50"
                              disabled={runMutation.isPending || runBusy}
                              onClick={() => runMutation.mutate({ mode: 'dry-run' })}
                            >
                              معاينة جافة
                            </button>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded border px-3 py-2 text-sm disabled:opacity-50"
                      disabled={runMutation.isPending || runBusy}
                      onClick={() => runMutation.mutate({ mode: 'analyze' })}
                    >
                      تحليل
                    </button>
                    <button
                      type="button"
                      className="rounded border px-3 py-2 text-sm disabled:opacity-50"
                      disabled={runMutation.isPending || runBusy}
                      onClick={() => runMutation.mutate({ mode: 'dry-run' })}
                    >
                      معاينة جافة
                    </button>
                    <button
                      type="button"
                      className="rounded bg-[#0E78AA] px-3 py-2 text-sm text-white disabled:opacity-50"
                      disabled={!confirmWrite || runMutation.isPending}
                      onClick={() =>
                        runMutation.mutate({ mode: 'import', confirmTargetWrite: true })
                      }
                    >
                      تنفيذ الترحيل
                    </button>
                  </div>
                )}
                <MigrationPipelineVisual progress={liveProgress} />
                {operatorView && activeJobId && !liveProgress ? (
                  <p className="text-xs text-slate-500">
                    إن لم تكن أنشأت مهمة بعد، ارجع لخطوة «الاتصال» واضغط «إنشاء مهمة ترحيل».
                  </p>
                ) : null}
              </div>
            )}

            {step === 'results' && activeJobId && (
              <ResultsPanel
                jobId={activeJobId}
                progress={liveProgress}
                caps={caps}
                onBack={() => {
                  autoOpenedResults.current = true;
                  setStep('run');
                }}
              />
            )}

            {!operatorView && caps?.blockedModules?.length ? (
              <>
                <h2 className="mt-2 font-bold text-[#0A3D5E]">وحدات غير مدعومة / محظورة</h2>
                <ul className="list-disc space-y-1 pr-5 text-sm text-slate-600">
                  {caps.blockedModules.map((b) => (
                    <li key={b}>{blockedModuleLabelAr(b)}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        </InnerCard>
      </OuterCard>

      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}
    </>
  );
}

type CoreCoverageArea = {
  id: string;
  labelAr: string;
  implemented: boolean;
  legacyRowCount?: number | null;
  gaps: string[];
  legacyTables: string[];
  targetModels: string[];
};

const INVENTORY_CUTOVER_OPTIONS = [
  {
    id: 'PERIODIC_LEGACY_NO_INV_GL_REPOST',
    label: 'دوري — لا إعادة ترحيل GL مخزون (الافتراضي الآمن)',
  },
  { id: 'PERPETUAL_MAC_SUBLEDGER_ONLY', label: 'دائم — حركات + MAC فقط (بدون قيود مخزون جديدة)' },
  {
    id: 'PERPETUAL_WITH_OWNER_OPENING_STOCK_JE',
    label: 'دائم — مع قيد افتتاح مخزون (يتطلب قرار مالك + تسوية GL)',
  },
] as const;

function CoreCoveragePanel({
  jobId,
  variant = 'full',
}: {
  jobId: string;
  variant?: 'full' | 'operator';
}) {
  const [inventoryPolicy, setInventoryPolicy] = useState<string>('');
  const invalidate = useInvalidateQuery();
  const [openingJeApproved, setOpeningJeApproved] = useState(false);
  const { data } = useApiQuery<{
    areas: CoreCoverageArea[];
    inventoryCutoverPolicy: string;
    inventoryCutoverPolicySelected?: boolean;
    schemaCoverage?: {
      totals: {
        discoveredTables: number;
        discoveredColumns: number;
        coreColumnsMapped: number;
        coreColumnsMetadata: number;
        coreColumnsUnsupported: number;
        coreColumnsMissingImplementation?: number;
        coreTablesWithoutImporter: string[];
      };
    };
    fieldCoverage?: {
      totals: {
        coreColumns: number;
        mapped: number;
        transformed: number;
        metadata: number;
        idMapKey: number;
        evidenceBlocked: number;
        missingImplementation: number;
      };
      remainingGapCount: number;
    };
    offline?: boolean;
  }>(['migration-engine', 'coverage', jobId], `/migration-engine/jobs/${jobId}/coverage`);
  const savePolicy = useApiMutation<
    unknown,
    { inventoryCutoverPolicy?: string; inventoryOpeningJeApproved?: boolean }
  >(
    `/migration-engine/jobs/${jobId}/settings`,
    'PATCH',
    {
      onSuccess: () => invalidate(['migration-engine', 'coverage', jobId]),
    }
  );
  const matrix = data?.data;
  const operator = variant === 'operator';
  return (
    <div className="mb-4 space-y-2 rounded border border-slate-200 p-3 text-sm dark:border-slate-700">
      {!matrix ? <p className="text-xs text-slate-500">جاري تحميل ملخص التغطية…</p> : null}
      {matrix ? (
        <>
      {!operator ? (
        <p className="font-semibold text-[#0A3D5E]">تغطية الوحدات الأساسية (9)</p>
      ) : (
        <p className="text-xs text-slate-600">
          سياسة المخزون على هذه المهمة:{' '}
          <span className="font-medium text-emerald-800">
            {matrix.inventoryCutoverPolicySelected
              ? 'محفوظة — دوري (افتراضي آمن) أو ما اخترته سابقاً'
              : 'تُطبَّق تلقائياً عند التشغيل إن لم تُختر غيرها'}
          </span>
        </p>
      )}
      {!operator ? <p className="text-xs text-slate-500">{matrix.inventoryCutoverPolicy}</p> : null}
      <div
        className={`rounded border p-2 text-xs ${
          operator && matrix.inventoryCutoverPolicySelected
            ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900'
            : 'border-amber-200 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/30'
        }`}
      >
        <p className="font-medium text-amber-900 dark:text-amber-200">
          {operator ? 'تغيير سياسة المخزون (اختياري — للمالك فقط)' : 'سياسة محاسبة المخزون (مطلوبة قبل التفعيل)'}
        </p>
        {operator ? (
          <p className="mt-1 text-slate-600">
            الافتراضي: لا إعادة ترحيل قيود مخزون من GL القديم. غيّر فقط بقرار محاسبي واضح.
          </p>
        ) : null}
        <select
          className="mt-2 w-full rounded border px-2 py-1 text-sm"
          value={inventoryPolicy}
          onChange={(e) => setInventoryPolicy(e.target.value)}
        >
          <option value="">— اختر السياسة —</option>
          {INVENTORY_CUTOVER_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="mt-2 rounded bg-[#0E78AA] px-3 py-1 text-white disabled:opacity-50"
          disabled={!inventoryPolicy || savePolicy.isPending}
          onClick={() => savePolicy.mutate({ inventoryCutoverPolicy: inventoryPolicy })}
        >
          حفظ السياسة
        </button>
        {matrix.inventoryCutoverPolicySelected ? (
          <p className="mt-1 text-emerald-800">تم حفظ سياسة المخزون على هذه المهمة.</p>
        ) : null}
        {!operator ? (
          <>
            <label className="mt-2 flex items-center gap-2">
              <input
                type="checkbox"
                checked={openingJeApproved}
                onChange={(e) => setOpeningJeApproved(e.target.checked)}
              />
              <span>موافقة المالك على مسودة قيد افتتاح المخزون (لا يُرحّل تلقائياً)</span>
            </label>
            <button
              type="button"
              className="mt-2 rounded border px-3 py-1 disabled:opacity-50"
              disabled={savePolicy.isPending}
              onClick={() => savePolicy.mutate({ inventoryOpeningJeApproved: openingJeApproved })}
            >
              حفظ موافقة قيد الافتتاح
            </button>
          </>
        ) : null}
      </div>
      {!operator && matrix.schemaCoverage?.totals ? (
        <div className="rounded border border-slate-200 bg-slate-50/80 p-2 text-xs dark:border-slate-700">
          <p className="font-medium">تغطية المخطط (erp_schema.txt)</p>
          <p>
            جداول: {matrix.schemaCoverage.totals.discoveredTables} · أعمدة:{' '}
            {matrix.schemaCoverage.totals.discoveredColumns} · أساسي mapped:{' '}
            {matrix.schemaCoverage.totals.coreColumnsMapped} · metadata:{' '}
            {matrix.schemaCoverage.totals.coreColumnsMetadata} · missing:{' '}
            {matrix.schemaCoverage.totals.coreColumnsMissingImplementation ?? matrix.schemaCoverage.totals.coreColumnsUnsupported}
          </p>
          {matrix.schemaCoverage.totals.coreTablesWithoutImporter.length ? (
            <p className="text-amber-800">
              بدون مستورد: {matrix.schemaCoverage.totals.coreTablesWithoutImporter.join(', ')}
            </p>
          ) : null}
        </div>
      ) : null}
      {!operator && matrix.fieldCoverage?.totals ? (
        <div className="rounded border border-slate-200 bg-slate-50/80 p-2 text-xs dark:border-slate-700">
          <p className="font-medium">تغطية الحقول (36 جدول أساسي — من الكود)</p>
          <p>
            mapped {matrix.fieldCoverage.totals.mapped} · transformed{' '}
            {matrix.fieldCoverage.totals.transformed} · metadata {matrix.fieldCoverage.totals.metadata} ·
            id-map {matrix.fieldCoverage.totals.idMapKey} · blocked{' '}
            {matrix.fieldCoverage.totals.evidenceBlocked} · gaps{' '}
            {matrix.fieldCoverage.totals.missingImplementation} ({matrix.fieldCoverage.remainingGapCount}{' '}
            صف في التقرير)
          </p>
        </div>
      ) : null}
      {!operator && matrix.offline ? (
        <p className="text-xs text-amber-700">شغّل «تحليل» لتحديث أعداد السجلات من المصدر.</p>
      ) : null}
      {!operator ? (
        <div className="grid gap-2 md:grid-cols-2">
          {matrix.areas.map((a) => (
            <div key={a.id} className="rounded bg-white/80 p-2 dark:bg-slate-900/50">
              <div className="flex justify-between gap-2">
                <span className="font-medium">{a.labelAr}</span>
                <span className={a.implemented ? 'text-emerald-700' : 'text-red-600'}>
                  {a.implemented ? 'مُنفَّذ' : 'غير مكتمل'}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                مصدر: {a.legacyTables.slice(0, 3).join(', ')}
                {a.legacyRowCount != null && a.legacyRowCount >= 0 ? ` · ~${a.legacyRowCount} صف` : ''}
              </p>
              {a.gaps[0] ? (
                <p className="mt-1 text-xs text-amber-800">{coreCoverageGapAr(a.gaps[0])}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          ملخص الوحدات التسعة وتقارير الأعمدة متاحة عند تفعيل «عرض تفاصيل تقنية».
        </p>
      )}
        </>
      ) : null}
      {!operator ? (
        <>
          <FieldCoverageReportSection />
          <SchemaTablesReportSection />
        </>
      ) : null}
    </div>
  );
}

type PaginatedApi<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

function FieldCoverageReportSection() {
  const [page, setPage] = useState(1);
  const [gapsOnly, setGapsOnly] = useState(false);
  const { data, isLoading } = useApiQuery<PaginatedApi<Record<string, unknown>>>(
    ['migration-engine', 'field-coverage', page, gapsOnly],
    '/migration-engine/coverage/fields',
    { page, limit: MIGRATION_REPORT_PAGE_SIZE, ...(gapsOnly ? { gapsOnly: 'true' } : {}) }
  );
  const payload = data?.data;
  return (
    <div className="rounded border border-slate-200 bg-slate-50/80 p-2 text-xs dark:border-slate-700">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <p className="font-medium text-[#0A3D5E]">تقرير الحقول (كل الأعمدة الأساسية)</p>
        <label className="flex items-center gap-1 text-slate-600">
          <input type="checkbox" checked={gapsOnly} onChange={(e) => { setGapsOnly(e.target.checked); setPage(1); }} />
          الفجوات فقط
        </label>
      </div>
      <MigrationPaginatedReportTable
        title="صفوف التغطية"
        columns={FIELD_COVERAGE_COLUMNS}
        rows={payload?.items ?? []}
        total={payload?.total ?? 0}
        page={payload?.page ?? page}
        pageSize={payload?.limit ?? MIGRATION_REPORT_PAGE_SIZE}
        totalPages={payload?.totalPages ?? 1}
        onPageChange={setPage}
        loading={isLoading}
      />
    </div>
  );
}

function SchemaTablesReportSection() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useApiQuery<PaginatedApi<Record<string, unknown>>>(
    ['migration-engine', 'schema-tables', page],
    '/migration-engine/coverage/schema/tables',
    { page, limit: MIGRATION_REPORT_PAGE_SIZE }
  );
  const payload = data?.data;
  return (
    <div className="rounded border border-slate-200 bg-slate-50/80 p-2 text-xs dark:border-slate-700">
      <MigrationPaginatedReportTable
        title="تقرير الجداول (erp_schema)"
        columns={SCHEMA_TABLE_COLUMNS}
        rows={payload?.items ?? []}
        total={payload?.total ?? 0}
        page={payload?.page ?? page}
        pageSize={payload?.limit ?? MIGRATION_REPORT_PAGE_SIZE}
        totalPages={payload?.totalPages ?? 1}
        onPageChange={setPage}
        loading={isLoading}
      />
    </div>
  );
}

function RemoteSqlSourcePanel({
  legacyCompanyCode,
  host,
  port,
  database,
  user,
  password,
  onChange,
  onSuccess,
  onError,
}: {
  legacyCompanyCode: string;
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
  onChange: (p: Partial<{ host: string; port: string; database: string; user: string; password: string }>) => void;
  onSuccess: (message?: string) => void;
  onError: (m: string) => void;
}) {
  const [connectionStringPaste, setConnectionStringPaste] = useState('');
  const [trustServerCertificate, setTrustServerCertificate] = useState(true);
  const hydratedFromServer = useRef(false);
  const invalidate = useInvalidateQuery();
  const { data: savedRemoteRes } = useApiQuery<{
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    status?: string;
  }>(
    ['migration-engine', 'source-remote'],
    '/migration-engine/source/remote',
    undefined,
    { skipErrorNotify: true }
  );

  useEffect(() => {
    const d = savedRemoteRes?.data;
    if (hydratedFromServer.current || !d?.host) return;
    hydratedFromServer.current = true;
    const split = normalizeSqlHostPort(d.host, String(d.port ?? 1433));
    onChange({
      host: split.host,
      port: split.port,
      database: d.database ?? '',
      user: d.user ?? '',
    });
  }, [savedRemoteRes?.data, onChange]);

  const save = useApiMutation<unknown, Record<string, unknown>>('/migration-engine/source/remote', 'PUT', {
    showSuccessToast: false,
    skipErrorNotify: true,
  });
  const test = useApiMutation<
    { lastTestOk?: boolean; lastTestMessage?: string | null },
    { legacyCompanyCode?: string }
  >('/migration-engine/source/remote/test', 'POST', {
    showSuccessToast: false,
    skipErrorNotify: true,
  });

  const migrationApiError = (e: unknown) => {
    const err = e as Error & Partial<ApiError>;
    return formatApiErrorMessage(err);
  };

  const remotePayload = () => {
    const split = normalizeSqlHostPort(host, port);
    return {
      host: split.host,
      port: Number(split.port) || 1433,
      database: database.trim(),
      user: user.trim(),
      password,
      encrypt: true,
      trustServerCertificate,
    };
  };

  const runSaveThenTest = () => {
    const payload = remotePayload();
    if (payload.host !== host.trim() || String(payload.port) !== port.trim()) {
      onChange({ host: payload.host, port: String(payload.port) });
    }
    const applyTestResult = (res: { data?: { lastTestOk?: boolean; lastTestMessage?: string | null } }) => {
      invalidate(['migration-engine', 'source-remote']);
      invalidate(['migration-engine', 'capabilities']);
      const row = res?.data;
      if (row?.lastTestOk) {
        onSuccess('تم اختبار الاتصال — المصدر جاهز (READY)');
        return;
      }
      const detail = row?.lastTestMessage?.trim();
      onError(
        detail
          ? formatApiErrorMessage(Object.assign(new Error(detail), { code: '400' }) as Error & ApiError)
          : 'فشل اختبار الاتصال — راجع Host وكلمة المرور وخيار Trust server certificate'
      );
    };
    if (!payload.host || !payload.database || !payload.user || !payload.password) {
      test.mutate({ legacyCompanyCode }, {
        onSuccess: applyTestResult,
        onError: (e) => onError(migrationApiError(e)),
      });
      return;
    }
    save.mutate(payload, {
      onSuccess: () => {
        invalidate(['migration-engine', 'source-remote']);
        test.mutate(
          { legacyCompanyCode },
          {
            onSuccess: applyTestResult,
            onError: (e) => onError(migrationApiError(e)),
          }
        );
      },
      onError: (e) => onError(migrationApiError(e)),
    });
  };

  const applyConnectionString = () => {
    const parsed = parseMssqlConnectionString(connectionStringPaste);
    if (!parsed) {
      onError('تعذّر قراءة connection string — استخدم Server=…;Database=…;User Id=…;Password=…');
      return;
    }
    onChange(parsed);
    onSuccess('تم تعبئة الحقول من connection string — راجع كلمة المرور ثم احفظ');
  };

  return (
    <div className="max-w-xl space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-sm">
      <p className="text-slate-700">
        هذا هو بديل «Legacy Forensic»: تُحفظ بيانات الاتصال مشفّرة للشركة (لا تُخزَّن في متغيّر{' '}
        <span className="font-mono text-xs">LEGACY_FORENSIC_URL</span> على السيرفر إلا كخيار DevOps).
      </p>
      <label className="block">
        <span className="font-semibold text-slate-700">لصق connection string (اختياري)</span>
        <textarea
          className="mt-1 min-h-[72px] w-full rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-xs"
          placeholder="Server=host,1433;Database=LegacyForensic;User Id=…;Password=…;Encrypt=true"
          value={connectionStringPaste}
          onChange={(e) => setConnectionStringPaste(e.target.value)}
        />
      </label>
      <button type="button" className="rounded border bg-white px-3 py-1.5 text-xs" onClick={applyConnectionString}>
        تعبئة الحقول من النص
      </button>
      <div className="grid gap-2">
        <input
          className="h-9 rounded border px-2"
          placeholder="اسم السيرفر أو IP فقط (بدون ,1433)"
          value={host}
          onChange={(e) => onChange({ host: e.target.value })}
          onBlur={() => {
            const split = normalizeSqlHostPort(host, port);
            if (split.host !== host || split.port !== port) onChange(split);
          }}
        />
        <input
          className="h-9 rounded border px-2"
          placeholder="Port"
          value={port}
          onChange={(e) => onChange({ port: e.target.value })}
        />
        <input
          className="h-9 rounded border px-2"
          placeholder="Database"
          value={database}
          onChange={(e) => onChange({ database: e.target.value })}
        />
        <input
          className="h-9 rounded border px-2"
          placeholder="User"
          value={user}
          onChange={(e) => onChange({ user: e.target.value })}
        />
        <input
          className="h-9 rounded border px-2"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => onChange({ password: e.target.value })}
        />
      </div>
      <label className="flex items-center gap-2 text-xs text-slate-700">
        <input
          type="checkbox"
          checked={trustServerCertificate}
          onChange={(e) => setTrustServerCertificate(e.target.checked)}
        />
        Trust server certificate (مطلوب غالباً لـ SQL محلي / بدون شهادة)
      </label>
      {savedRemoteRes?.data?.status === 'READY' ? (
        <p className="text-xs text-emerald-800">اتصال محفوظ سابقاً — أعد إدخال كلمة المرور إن لزم ثم «اختبار الاتصال».</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded border bg-white px-3 py-1.5 text-xs"
          disabled={save.isPending || !host || !database || !user || !password}
          onClick={() =>
            save.mutate(remotePayload(), {
              onSuccess: () => {
                invalidate(['migration-engine', 'source-remote']);
                invalidate(['migration-engine', 'capabilities']);
                onSuccess('تم حفظ إعدادات الاتصال — اضغط «اختبار الاتصال» لتفعيل المصدر');
              },
              onError: (e) => onError(migrationApiError(e)),
            })
          }
        >
          حفظ الاتصال
        </button>
        <button
          type="button"
          className="rounded border bg-white px-3 py-1.5 text-xs"
          disabled={test.isPending || save.isPending}
          onClick={runSaveThenTest}
        >
          اختبار الاتصال
        </button>
      </div>
    </div>
  );
}

function ConnectorSourcePanel({
  caps,
  onSuccess,
  onError,
}: {
  caps?: MigrationCapabilities;
  onSuccess: (m: string) => void;
  onError: (m: string) => void;
}) {
  const [code, setCode] = useState('');
  const [downloading, setDownloading] = useState(false);
  const release = caps?.agentRelease;
  const pairingApi = pairingApiFromWindow(caps?.agentPairingApiBase);
  const issue = useApiMutation<{ code: string; expiresInSeconds: number }, Record<string, never>>(
    '/migration-engine/source/connector/pairing-code',
    'POST',
    { showSuccessToast: false, skipErrorNotify: true }
  );
  return (
    <div className="max-w-xl space-y-2 text-sm">
      <p className="font-semibold text-[#0A3D5E]">الترحيل من جهازي</p>
      <p className="text-slate-600">
        شغّل Gates Migration Agent على جهاز ويندوز يصل إلى SQL Server. الاتصال يخرج من جهازك إلى Gates.
        لا تفتح منفذ SQL على الإنترنت، ولا ترسل كلمة مرور قاعدة البيانات إلى المتصفح أو إلى Railway.
      </p>
      {release?.available ? (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950 space-y-1">
          <p>
            نسخة اختبار داخلية {release.version}
            {release.signed ? '' : ' — غير موقّعة'}.
          </p>
          <p>{release.warningAr}</p>
          {release.sha256 ? <p className="font-mono break-all">SHA-256: {release.sha256}</p> : null}
          <button
            type="button"
            className="rounded border border-amber-700 bg-white px-3 py-1.5 text-xs"
            disabled={downloading}
            onClick={() => {
              setDownloading(true);
              void downloadMigrationAgent()
                .then((r) => onSuccess(`تم تنزيل ${r.fileName}. تحقق من SHA-256 قبل التشغيل.`))
                .catch((e: { message?: string }) => onError(e?.message ?? 'فشل التنزيل'))
                .finally(() => setDownloading(false));
            }}
          >
            {downloading ? 'جاري التنزيل…' : `تنزيل Gates Migration Agent ${release.version}`}
          </button>
        </div>
      ) : (
        <p className="text-xs text-amber-800">
          ملف الوكيل غير منشور على هذا الخادم بعد. هذه ليست نسخة موقّعة للعملاء.
        </p>
      )}
      {pairingApi ? (
        <p className="text-xs text-slate-600">
          عنوان API للوكيل:{' '}
          <span className="font-mono break-all">{pairingApi}</span>
        </p>
      ) : null}
      <button
        type="button"
        className="rounded border px-3 py-1.5 text-xs"
        onClick={() =>
          issue.mutate(
            {},
            {
              onSuccess: (r) => {
                setCode(r?.data?.code ?? '');
                onSuccess('تم إنشاء رمز الربط. أدخله في البرنامج على جهاز ويندوز.');
              },
              onError: (e: { message?: string }) => onError(e?.message ?? 'فشل'),
            }
          )
        }
      >
        إنشاء رمز الربط
      </button>
      {code ? (
        <p className="rounded bg-slate-100 px-3 py-2 font-mono text-lg tracking-widest">{code}</p>
      ) : null}
      <p className="text-xs text-amber-900">
        بعد إدخال بيانات SQL لازم تفضل نافذة البرنامج مفتوحة وتظهر جملة Connected to legacy SQL Server.
        لو قفلت لوحدها، شغّل البرنامج من PowerShell عشان تشوف آخر سطر. متضغطش «إنشاء مهمة ترحيل» والنافذة مقفولة.
      </p>
      <p className="text-xs text-slate-500">
        الرمز يُستخدم مرة واحدة وينتهي خلال 15 دقيقة. بعد الربط يُربط المصدر تلقائياً بهذه الشركة.
        الوضع 1 يقرأ قاعدة موجودة بصلاحية قراءة فقط. الوضع 2 يستعيد .bak إلى قاعدة جديدة باسم GatesAgentRestore_
        ولا يحذف الأصل ولا يستخدم REPLACE.
      </p>
    </div>
  );
}

function PackageRestoreAssessment({ packageId }: { packageId: string }) {
  const startRestore = useApiMutation<{ id: string; status: string }, { migrationJobId?: string }>(
    `/migration-engine/packages/${packageId}/restore-run`,
    'POST'
  );
  return (
    <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-900 space-y-2">
      <p className="font-semibold text-slate-800">استعادة .bak (خدمة معزولة)</p>
      <p className="text-slate-700">
        بعد اكتمال الاستعادة يُربط مصدر BACKUP_RESTORE تلقائياً — لا حاجة لـ LEGACY_FORENSIC_URL اليدوي.
      </p>
      <button
        type="button"
        className="rounded border px-2 py-1"
        disabled={startRestore.isPending}
        onClick={() => startRestore.mutate({})}
      >
        {startRestore.isPending ? 'جاري الجدولة…' : 'بدء الاستعادة على SQL المعزول'}
      </button>
      {startRestore.data?.data?.status ? (
        <p className="text-emerald-700">حالة: {startRestore.data.data.status}</p>
      ) : null}
    </div>
  );
}

function MappingPanel({ jobId, onContinue }: { jobId: string; onContinue: () => void }) {
  const [legacyCode, setLegacyCode] = useState('');
  const [targetCode, setTargetCode] = useState('');
  const [reason, setReason] = useState('');
  const [approvedBy, setApprovedBy] = useState('');
  const [evidence, setEvidence] = useState('');
  const [mappingIssuePage, setMappingIssuePage] = useState(1);
  const invalidate = useInvalidateQuery();

  const { data, isLoading: mappingLoading } = useApiQuery<{
    overrides: unknown[];
    openMappingIssues: Record<string, unknown>[];
    mappingIssuesPagination?: PaginatedApi<unknown>;
  }>(
    ['migration-engine', 'mapping', jobId, mappingIssuePage],
    `/migration-engine/jobs/${jobId}/mapping/accounts`,
    { page: mappingIssuePage, limit: MIGRATION_REPORT_PAGE_SIZE }
  );

  const saveOverride = useApiMutation<unknown, Record<string, string>>(
    `/migration-engine/jobs/${jobId}/mapping/accounts`,
    'POST',
    {
      onSuccess: () => {
        invalidate(['migration-engine', 'mapping', jobId]);
      },
    }
  );

  const issues = data?.data?.openMappingIssues ?? [];
  const overrides = data?.data?.overrides ?? [];
  const mapPag = data?.data?.mappingIssuesPagination;

  return (
    <div className="space-y-2">
      <h2 className="font-bold text-[#0A3D5E]">ربط الحسابات</h2>
      <p className="text-sm text-slate-600">
        التعديلات المحاسبية الحساسة تتطلب موافقة مالك ومسجلة في LegacyAccountOverride — لا يتم اعتماد ربط غامض
        تلقائياً.
      </p>
      <p className="mt-2 text-sm">تعريفات معتمدة: {overrides.length}</p>
      <p className="text-sm">قضايا ربط مفتوحة: {mapPag?.total ?? issues.length}</p>
      <MigrationPaginatedReportTable
        title="قضايا الربط المفتوحة"
        columns={[
          { key: 'severity', label: 'الخطورة', minWidth: 90 },
          { key: 'category', label: 'التصنيف', minWidth: 140 },
          { key: 'description', label: 'الوصف', minWidth: 400 },
        ]}
        rows={issues}
        total={mapPag?.total ?? issues.length}
        page={mapPag?.page ?? mappingIssuePage}
        pageSize={mapPag?.limit ?? MIGRATION_REPORT_PAGE_SIZE}
        totalPages={mapPag?.totalPages ?? 1}
        onPageChange={setMappingIssuePage}
        loading={mappingLoading}
      />
      <div className="mt-4 grid max-w-lg gap-2 text-sm">
        <input className="rounded border px-2 py-1" placeholder="رمز الحساب القديم" value={legacyCode} onChange={(e) => setLegacyCode(e.target.value)} />
        <input className="rounded border px-2 py-1" placeholder="رمز الحساب الهدف (POSTING)" value={targetCode} onChange={(e) => setTargetCode(e.target.value)} />
        <input className="rounded border px-2 py-1" placeholder="السبب" value={reason} onChange={(e) => setReason(e.target.value)} />
        <input className="rounded border px-2 py-1" placeholder="اعتمد بواسطة" value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} />
        <input className="rounded border px-2 py-1" placeholder="مرجع Evidence" value={evidence} onChange={(e) => setEvidence(e.target.value)} />
        <button
          type="button"
          className="rounded bg-slate-800 px-3 py-2 text-white disabled:opacity-50"
          disabled={saveOverride.isPending}
          onClick={() =>
            saveOverride.mutate({
              legacyAccountCode: legacyCode,
              targetLegacyAccountCode: targetCode,
              reason,
              approvedBy,
              evidenceReference: evidence,
            })
          }
        >
          حفظ الربط
        </button>
      </div>
      <button type="button" className="mt-4 rounded bg-[#0E78AA] px-4 py-2 text-sm text-white" onClick={onContinue}>
        متابعة
      </button>
    </div>
  );
}

function JobControlBar({
  jobId,
  status,
  onAborted,
  onAbortError,
}: {
  jobId: string;
  status?: string;
  onAborted?: () => void;
  onAbortError?: (message: string) => void;
}) {
  const pause = useApiMutation<unknown, Record<string, never>>(
    `/migration-engine/jobs/${jobId}/pause`,
    'POST',
    { skipErrorNotify: true, showSuccessToast: false }
  );
  const resume = useApiMutation<unknown, Record<string, never>>(
    `/migration-engine/jobs/${jobId}/resume`,
    'POST',
    { skipErrorNotify: true, showSuccessToast: false }
  );
  const rollback = useApiMutation<unknown, Record<string, never>>(
    `/migration-engine/jobs/${jobId}/rollback`,
    'POST',
    {
      skipErrorNotify: true,
      showSuccessToast: false,
      onSuccess: () => onAborted?.(),
      onError: (e) =>
        onAbortError?.(formatApiErrorMessage(e as Error & ApiError) || 'تعذّر إيقاف المهمة'),
    }
  );
  const runningNow = ['RUNNING', 'DRY_RUNNING', 'ANALYZING', 'RECONCILING'].includes(status ?? '');
  return (
    <div className="flex flex-wrap gap-2">
      {runningNow ? (
        <button
          type="button"
          className="rounded border border-amber-600 px-3 py-1 text-sm text-amber-800"
          disabled={pause.isPending}
          onClick={() => pause.mutate({})}
        >
          إيقاف مؤقت
        </button>
      ) : null}
      {status === 'PAUSED' ? (
        <button
          type="button"
          className="rounded bg-[#0E78AA] px-3 py-1 text-sm text-white"
          disabled={resume.isPending}
          onClick={() => resume.mutate({})}
        >
          استئناف
        </button>
      ) : null}
      <button
        type="button"
        className="rounded border border-red-600 px-3 py-1 text-sm text-red-700 disabled:opacity-50"
        disabled={rollback.isPending}
        onClick={() => rollback.mutate({})}
      >
        {rollback.isPending ? 'جاري الإيقاف…' : 'إيقاف التشغيل'}
      </button>
    </div>
  );
}

function ResultsPanel({
  jobId,
  progress,
  caps,
  onBack,
}: {
  jobId: string;
  progress: MigrationProgressSnapshot | null;
  caps?: MigrationCapabilities;
  onBack?: () => void;
}) {
  const [issuePage, setIssuePage] = useState(1);
  const { data: detail } = useApiQuery<{
    lifecycle?: MigrationLifecycleState;
    reconciliation?: {
      summary?: { materialPass?: boolean; blockingReasons?: string[] };
      settlement?: { invoicePaidMismatchCount?: number };
      cheques?: { migratedCheques?: number };
      journalIntegrity?: { deltaSinceOperationalBaseline?: number | null };
      completeness?: { entity: string; source: number; migrated: number; missing: number }[];
    };
    job?: { progress?: { rollback?: { status?: 'RUNNING' | 'DONE' | 'FAILED'; error?: string } } };
    preflight?: {
      checkedAt?: string;
      findings?: {
        code: string;
        action: 'ADD' | 'FIX' | 'IGNORE';
        severity: string;
        count: number;
        messageAr: string;
        samples: string[];
      }[];
    } | null;
  }>(['migration-engine', 'job-detail', jobId], `/migration-engine/jobs/${jobId}`, undefined, {
    skipErrorNotify: true,
  });

  const { data: issuesRes, isLoading: issuesLoading } = useApiQuery<PaginatedApi<Record<string, unknown>>>(
    ['migration-engine', 'job-issues', jobId, issuePage],
    `/migration-engine/jobs/${jobId}/issues`,
    { page: issuePage, limit: MIGRATION_REPORT_PAGE_SIZE },
    { skipErrorNotify: true }
  );

  const activate = useApiMutation<unknown, { confirmMaterialExceptions?: boolean }>(
    `/migration-engine/jobs/${jobId}/activate`,
    'POST'
  );

  const lifecycle = detail?.data?.lifecycle;
  const recon = detail?.data?.reconciliation?.summary;
  const issuesPayload = issuesRes?.data;
  const lastErrorRaw =
    progress?.ui && typeof progress.ui.lastError === 'string' ? progress.ui.lastError.trim() : '';
  const lastError = lastErrorRaw ? explainMigrationEngineAlert(lastErrorRaw) : '';

  return (
    <div className="space-y-2">
      <h2 className="font-bold text-[#0A3D5E]">النتيجة</h2>
      {onBack ? (
        <button
          type="button"
          className="rounded border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
          onClick={onBack}
        >
          رجوع للتشغيل
        </button>
      ) : null}
      <p className="text-sm">المهمة: {jobId}</p>
      <p className="text-sm">الحالة: {progress?.status ?? '—'}</p>
      <p className="text-sm">مرحلة دورة الحياة: {lifecycle?.phase ?? '—'}</p>
      <p className="text-sm">محظورات: {progress?.openBlockers ?? '—'}</p>
      <p className="text-sm">
        مطابقة مادية:{' '}
        {recon?.materialPass == null ? 'لم تُجرَ بعد (بعد التنفيذ فقط)' : recon.materialPass ? 'نعم' : 'لا'}
      </p>
      {lastError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          آخر خطأ: {lastError}
        </p>
      ) : null}
      {recon?.blockingReasons?.map((r) => (
        <p key={r} className="text-xs text-amber-700">
          {r}
        </p>
      ))}
      {detail?.data?.job?.progress?.rollback?.status ? (
        <p
          className={`text-sm ${
            detail.data.job.progress.rollback.status === 'FAILED' ? 'text-red-700' : 'text-slate-700'
          }`}
        >
          التراجع عن الترحيل:{' '}
          {detail.data.job.progress.rollback.status === 'RUNNING'
            ? 'جارٍ حذف ما تم ترحيله…'
            : detail.data.job.progress.rollback.status === 'DONE'
              ? 'تم حذف كل ما أنشأه الترحيل.'
              : `فشل: ${detail.data.job.progress.rollback.error ?? ''}`}
        </p>
      ) : null}
      <MigrationPreflightChecklist findings={detail?.data?.preflight?.findings} />
      {detail?.data?.reconciliation?.completeness?.length ? (
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="mb-2 text-sm font-semibold text-[#0A3D5E]">اكتمال النقل (المصدر ← المنقول)</p>
          <ul className="space-y-1 text-xs">
            {detail.data.reconciliation.completeness.map((row) => (
              <li key={row.entity} className={row.missing > 0 ? 'text-red-700' : 'text-emerald-700'}>
                {row.entity}: {row.migrated} / {row.source}
                {row.missing > 0 ? ` — ناقص ${row.missing}` : ' ✓'}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {detail?.data?.reconciliation?.journalIntegrity?.deltaSinceOperationalBaseline != null ? (
        <p className="text-xs text-slate-600">
          تغيّر عدد القيود بعد مراحل التشغيل:{' '}
          {detail.data.reconciliation.journalIntegrity.deltaSinceOperationalBaseline}
        </p>
      ) : null}
      {(issuesPayload?.total ?? 0) > 0 ? (
        <MigrationPaginatedReportTable
          title="قضايا الترحيل"
          columns={JOB_ISSUE_COLUMNS}
          rows={(issuesPayload?.items ?? []).map((row) => ({
            ...row,
            createdAt: row.createdAt ? String(row.createdAt).replace('T', ' ').slice(0, 19) : null,
          }))}
          total={issuesPayload?.total ?? 0}
          page={issuesPayload?.page ?? issuePage}
          pageSize={issuesPayload?.limit ?? MIGRATION_REPORT_PAGE_SIZE}
          totalPages={issuesPayload?.totalPages ?? 1}
          onPageChange={setIssuePage}
          loading={issuesLoading}
        />
      ) : null}
      <a
        className="inline-block text-sm text-[#0E78AA] underline"
        href={`/api/v1/migration-engine/jobs/${jobId}/reports/reconciliation?format=csv`}
        target="_blank"
        rel="noreferrer"
      >
        تنزيل تقرير المطابقة (CSV)
      </a>
      <button
        type="button"
        className="block rounded bg-emerald-700 px-4 py-2 text-sm text-white disabled:opacity-50"
        disabled={activate.isPending || lifecycle?.phase === 'ACTIVATED'}
        onClick={() => activate.mutate({ confirmMaterialExceptions: !recon?.materialPass })}
      >
        تفعيل الشركة بعد الترحيل
      </button>
      <p className="mt-2 text-xs text-slate-500">{supportedLegacyEngineAr(caps?.supportedLegacyEngine)}</p>
    </div>
  );
}

const PREFLIGHT_ACTION_AR: Record<'ADD' | 'FIX' | 'IGNORE', { title: string; tone: string }> = {
  ADD: { title: 'يجب إضافته في النظام القديم قبل الترحيل', tone: 'border-red-200 bg-red-50 text-red-900' },
  FIX: { title: 'يجب تصحيحه في النظام القديم قبل الترحيل', tone: 'border-amber-200 bg-amber-50 text-amber-900' },
  IGNORE: { title: 'سيتم تجاهله (يمكن حذفه)', tone: 'border-slate-200 bg-slate-50 text-slate-700' },
};

/** Pre-import checklist from Analyze: what to add / fix / ignore in the legacy data. */
function MigrationPreflightChecklist({
  findings,
}: {
  findings?: { code: string; action: 'ADD' | 'FIX' | 'IGNORE'; count: number; messageAr: string; samples: string[] }[];
}) {
  if (!findings) return null;
  const firing = findings.filter((f) => f.count !== 0);
  if (!firing.length) {
    return (
      <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
        فحص ما قبل الترحيل: لا توجد بيانات ناقصة أو تحتاج تصحيحًا.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-[#0A3D5E]">فحص ما قبل الترحيل</p>
      {(['ADD', 'FIX', 'IGNORE'] as const).map((action) => {
        const rows = firing.filter((f) => f.action === action);
        if (!rows.length) return null;
        return (
          <div key={action} className={`rounded-lg border px-3 py-2 text-xs ${PREFLIGHT_ACTION_AR[action].tone}`}>
            <p className="mb-1 font-semibold">{PREFLIGHT_ACTION_AR[action].title}</p>
            <ul className="list-disc space-y-1 pr-4">
              {rows.map((f) => (
                <li key={f.code}>
                  {f.messageAr}
                  {f.samples.length ? <span className="block opacity-75">أمثلة: {f.samples.join(' ؛ ')}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
