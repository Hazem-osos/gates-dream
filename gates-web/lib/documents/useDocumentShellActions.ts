'use client';

import { useMemo } from 'react';
import type { DocumentActionMenuProps } from '@/components/common/document-shell';
import {
  resolveDocumentActionPolicy,
  type DocumentActionPolicyOptions,
} from '@/lib/documents/document-action-policy';
import type { DocumentLifecycleInput } from '@/lib/documents/document-status-labels';

type Handlers = Pick<
  DocumentActionMenuProps,
  | 'onNew'
  | 'onEdit'
  | 'onPost'
  | 'onUnpost'
  | 'onVoid'
  | 'onRestore'
  | 'onPrint'
  | 'postLabel'
  | 'unpostLabel'
  | 'voidLabel'
  | 'restoreLabel'
  | 'postPending'
  | 'unpostPending'
  | 'voidPending'
  | 'restorePending'
>;

type Options = DocumentActionPolicyOptions & {
  hidePostActions?: boolean;
};

/**
 * Maps lifecycle + handlers to `standardActions`, applying the shared enable/disable matrix.
 */
export function useDocumentShellActions(
  lifecycle: DocumentLifecycleInput,
  handlers: Handlers,
  options: Options = {}
): DocumentActionMenuProps {
  const policy = useMemo(
    () =>
      resolveDocumentActionPolicy(lifecycle, {
        allowEditWhenPosted: options.allowEditWhenPosted,
        allowEditWhenCancelled: options.allowEditWhenCancelled,
      }),
    [lifecycle, options.allowEditWhenPosted, options.allowEditWhenCancelled]
  );

  const hasDocument = Boolean(lifecycle.documentId?.trim());
  const isPosted = Boolean(lifecycle.isPosted);
  const isCancelled = Boolean(lifecycle.isCancelled);

  return {
    hasDocument,
    isPosted,
    isCancelled,
    hidePostActions: options.hidePostActions,
    allowEditWhenPosted: options.allowEditWhenPosted,
    allowEditWhenCancelled: options.allowEditWhenCancelled,
    onNew: handlers.onNew,
    onEdit: policy.edit.enabled ? handlers.onEdit : undefined,
    onPost: options.hidePostActions || !policy.post.enabled ? undefined : handlers.onPost,
    onUnpost: !policy.unpost.enabled ? undefined : handlers.onUnpost,
    onVoid: policy.void.enabled ? handlers.onVoid : undefined,
    onRestore: handlers.onRestore,
    onPrint: handlers.onPrint,
    postLabel: handlers.postLabel,
    unpostLabel: handlers.unpostLabel,
    voidLabel: handlers.voidLabel,
    restoreLabel: handlers.restoreLabel,
    postPending: handlers.postPending,
    unpostPending: handlers.unpostPending,
    voidPending: handlers.voidPending,
    restorePending: handlers.restorePending,
    editLockedHint: policy.edit.hint,
    voidLockedHint: policy.void.hint,
  };
}
