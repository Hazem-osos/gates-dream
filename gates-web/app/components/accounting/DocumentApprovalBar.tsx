'use client';

import React, { useState } from 'react';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import type { DocumentEntityType } from './DocumentActivityLog';

export type ApprovalState = {
  workflowStatus: string;
  requiresApproval: boolean;
  canSubmit: boolean;
  canApprove: boolean;
  canPost: boolean;
  canReject: boolean;
  blockReason?: string;
};

export function DocumentApprovalBar({
  entityType,
  entityId,
  isPosted,
  onError,
  onSuccess,
  onPost,
  postPending,
}: {
  entityType: DocumentEntityType;
  entityId: string | null | undefined;
  isPosted: boolean;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onPost: () => void;
  postPending?: boolean;
}) {
  const invalidateQuery = useInvalidateQuery();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const { data: stateRes, refetch } = useApiQuery<ApprovalState>(
    ['approval-state', entityType, entityId ?? ''],
    '/approval/state',
    entityId ? { entityType, entityId } : undefined,
    { enabled: !!entityId && !isPosted }
  );

  const state = stateRes?.data;

  const submitMutation = useApiMutation<unknown, { entityType: DocumentEntityType; entityId: string }>(
    '/approval/submit',
    'POST',
    { showSuccessToast: false }
  );
  const approveMutation = useApiMutation<
    unknown,
    { entityType: DocumentEntityType; entityId: string; note?: string }
  >('/approval/approve', 'POST', { showSuccessToast: false });
  const rejectMutation = useApiMutation<
    unknown,
    { entityType: DocumentEntityType; entityId: string; reason: string }
  >('/approval/reject', 'POST', { showSuccessToast: false });

  if (!entityId || isPosted || !state) return null;

  const refresh = () => {
    void refetch();
    invalidateQuery(['document-audit', entityType, entityId]);
    invalidateQuery(['approval-state', entityType, entityId]);
  };

  const bannerClass =
    state.workflowStatus === 'PENDING_APPROVAL'
      ? 'bg-amber-50 border-amber-200 text-amber-900'
      : state.workflowStatus === 'REJECTED'
        ? 'bg-red-50 border-red-200 text-red-900'
        : 'bg-sky-50 border-sky-200 text-sky-900';

  return (
    <div className={`rounded-lg border p-4 mb-4 ${bannerClass}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-bold text-sm">حالة الاعتماد: {state.workflowStatus}</p>
          {state.blockReason && <p className="text-xs mt-1 opacity-90">{state.blockReason}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {state.canSubmit && (
            <button
              type="button"
              className="px-4 py-2 bg-[#0E78AA] text-white rounded-lg text-sm font-medium disabled:opacity-50"
              disabled={submitMutation.isPending}
              onClick={() => {
                void submitMutation
                  .mutateAsync({ entityType, entityId })
                  .then(() => {
                    onSuccess('تم إرسال المستند للاعتماد');
                    refresh();
                  })
                  .catch((e: Error) => onError(e.message || 'فشل الإرسال'));
              }}
            >
              إرسال للاعتماد
            </button>
          )}
          {state.canApprove && (
            <button
              type="button"
              className="px-4 py-2 bg-[#25BB64] text-white rounded-lg text-sm font-medium disabled:opacity-50"
              disabled={approveMutation.isPending}
              onClick={() => {
                void approveMutation
                  .mutateAsync({ entityType, entityId })
                  .then(() => {
                    onSuccess('تم اعتماد المستند');
                    refresh();
                  })
                  .catch((e: Error) => onError(e.message || 'فشل الاعتماد'));
              }}
            >
              اعتماد
            </button>
          )}
          {state.canReject && (
            <button
              type="button"
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium"
              onClick={() => setRejectOpen(true)}
            >
              رفض
            </button>
          )}
          {state.canPost && (
            <button
              type="button"
              className="px-4 py-2 bg-[#094C6B] text-white rounded-lg text-sm font-medium disabled:opacity-50"
              disabled={postPending}
              onClick={onPost}
            >
              {postPending ? 'جاري الترحيل...' : 'ترحيل'}
            </button>
          )}
          {state.requiresApproval && state.canSubmit && (
            <span className="text-xs self-center text-gray-600">الترحيل المباشر غير متاح — يلزم الاعتماد</span>
          )}
        </div>
      </div>

      {rejectOpen && (
        <div className="mt-4 border-t border-red-200 pt-3">
          <label className="block text-sm font-medium mb-1">سبب الرفض</label>
          <textarea
            className="w-full border rounded-lg p-2 text-sm min-h-[72px]"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              className="px-3 py-1.5 bg-red-600 text-white rounded text-sm"
              disabled={rejectMutation.isPending || !rejectReason.trim()}
              onClick={() => {
                void rejectMutation
                  .mutateAsync({ entityType, entityId, reason: rejectReason.trim() })
                  .then(() => {
                    onSuccess('تم رفض المستند');
                    setRejectOpen(false);
                    setRejectReason('');
                    refresh();
                  })
                  .catch((e: Error) => onError(e.message || 'فشل الرفض'));
              }}
            >
              تأكيد الرفض
            </button>
            <button
              type="button"
              className="px-3 py-1.5 border rounded text-sm"
              onClick={() => setRejectOpen(false)}
            >
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
