'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { destinationAppTabHref } from '@/lib/navigation/tab-memory';
import { AiErrorModal } from './AiErrorModal';
import { askGatesAi } from '@/lib/ai/ask-screen-help';
import { diagnoseApiError, type DiagnoseErrorResult } from '@/lib/ai/diagnose-error';
import {
  extractFormValuesFromMessage,
  inferBusinessErrorCode,
  problemHeadline,
} from '@/lib/ai/infer-error-code';
import { getAiScreenSession, publishAiScreenSession } from '@/lib/ai/screen-session';
import { isBusinessSupportError, subscribeApiErrors } from '@/lib/api/api-error-notify';

const FALLBACK_STEPS = [
  'راجع رسالة الخطأ والحقول الإلزامية في الشاشة.',
  'لو المستند مرحّل، ألغِ الترحيل من قائمة (...) ثم أعد المحاولة.',
];

function isAuthRoute(pathname: string): boolean {
  return ['/login', '/register', '/forgot-password', '/logout', '/onboarding'].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

export function AiErrorExplainerRoot() {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState('');
  const [diagnosis, setDiagnosis] = useState<DiagnoseErrorResult | null>(null);

  useEffect(() => {
    return subscribeApiErrors((payload) => {
      if (isAuthRoute(pathname) || !isBusinessSupportError(payload)) return;

      const session = getAiScreenSession();
      const code = inferBusinessErrorCode(payload.message, payload.code);
      const headline = problemHeadline(session.pageTitle ?? '', code, payload.message);
      const parsedValues = extractFormValuesFromMessage(payload.message);

      publishAiScreenSession({
        formErrors: [payload.message],
        formValues: { ...session.formValues, ...parsedValues },
      });

      setProblem(headline);
      setDiagnosis(null);
      setOpen(true);
      setLoading(true);

      void diagnoseApiError({
        errorCode: code,
        errorMessage: payload.message,
        currentRoute: pathname,
        formValues: {
          ...session.formValues,
          ...parsedValues,
          documentStatus: session.documentStatus,
          rawMessage: payload.message,
        },
      })
        .then((result) => {
          setDiagnosis(result);
        })
        .catch(() => {
          setDiagnosis({
            errorCode: code,
            explanationAr: payload.message,
            correctiveSteps: FALLBACK_STEPS,
          });
        })
        .finally(() => setLoading(false));
    });
  }, [pathname]);

  const close = () => setOpen(false);

  const askChat = () => {
    const explanation = diagnosis?.explanationAr ?? problem;
    askGatesAi(
      `ظهرت لي هذه المشكلة في الشاشة الحالية: ${problem}\n${explanation}\nاشرح لي باختصار ماذا أفعل الآن.`
    );
    close();
  };

  const runQuickAction = () => {
    const action = diagnosis?.quickFixAction;
    if (!action) return;
    if (action.href) {
      router.push(destinationAppTabHref(action.href));
      close();
      return;
    }
    if (action.actionType === 'UNPOST_DOCUMENT' || action.actionType === 'OPEN_EDIT_MODE') {
      askGatesAi(
        `المستند الحالي حالته ${getAiScreenSession().documentStatus ?? 'غير معروفة'}. ${
          action.actionType === 'UNPOST_DOCUMENT'
            ? 'اشرح لي خطوة بخطوة كيف ألغي الترحيل من قائمة الثلاث نقاط ثم أعدّل.'
            : 'اشرح لي كيف أخرج من وضع العرض فقط وأبدأ التعديل من قائمة (...).'
        }`
      );
    }
    close();
  };

  return (
    <AiErrorModal
      open={open}
      problem={problem}
      explanation={diagnosis?.explanationAr ?? ''}
      steps={diagnosis?.correctiveSteps ?? []}
      loading={loading}
      quickAction={diagnosis?.quickFixAction}
      onClose={close}
      onAskChat={askChat}
      onQuickAction={runQuickAction}
    />
  );
}
