'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { ArrowUp, Camera, Mic, Paperclip, Square, X } from 'lucide-react';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { AiKnowledgeUploadButton } from './AiKnowledgeUploadButton';
import { INVOICE_OCR_ACCEPT, isInvoiceOcrFile } from '@/lib/ai/ingest-purchase-invoice';

type Props = {
  draft: string;
  setDraft: (value: string) => void;
  sending: boolean;
  streaming: boolean;
  onSend: () => void;
  onStop: () => void;
  onIngestInvoice?: (file: File, caption?: string) => void;
  autoFocus?: boolean;
};

export function AiCommandInput({
  draft,
  setDraft,
  sending,
  streaming,
  onSend,
  onStop,
  onIngestInvoice,
  autoFocus,
}: Props) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const voiceBaseRef = useRef('');
  const applyTranscript = useCallback(
    (text: string) => {
      const spoken = text.trim();
      if (!spoken) return;
      const base = voiceBaseRef.current.trim();
      setDraft(base ? `${base} ${spoken}` : spoken);
    },
    [setDraft]
  );
  const voice = useVoiceInput(applyTranscript);
  const { isListening, stopListening } = voice;
  const canSend = (Boolean(draft.trim()) || Boolean(attachment)) && !sending;

  useEffect(() => {
    if (sending && isListening) stopListening();
  }, [sending, isListening, stopListening]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [draft]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function pickFile(file?: File | null) {
    if (!file) return;
    if (!isInvoiceOcrFile(file)) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setAttachment(file);
    setPreviewUrl(file.type.startsWith('image/') ? URL.createObjectURL(file) : null);
  }

  function clearAttachment() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setAttachment(null);
    setPreviewUrl(null);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSend) return;
    if (attachment && onIngestInvoice) {
      onIngestInvoice(attachment, draft.trim() || undefined);
      clearAttachment();
      setDraft('');
      return;
    }
    onSend();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (canSend) {
        if (attachment && onIngestInvoice) {
          onIngestInvoice(attachment, draft.trim() || undefined);
          clearAttachment();
          setDraft('');
        } else {
          onSend();
        }
      }
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-200/80 bg-white p-2 shadow-xl transition-all focus-within:border-[#0E79AA] focus-within:ring-2 focus-within:ring-[#0E79AA]/30"
    >
      {attachment ? (
        <div className="mb-1.5 flex items-center gap-2 rounded-xl border border-[#D6EAF3] bg-[#F6FBFD] px-2 py-1.5">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white text-[10px] font-semibold text-[#0E79AA]">
              PDF
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-medium text-[#094C6B]">{attachment.name}</p>
            <p className="text-[10px] text-slate-400">جاهز للاستخراج كفاتورة مشتريات</p>
          </div>
          <button
            type="button"
            onClick={clearAttachment}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-white hover:text-slate-700"
            aria-label="إزالة المرفق"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
      <textarea
        ref={inputRef}
        rows={1}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          voice.isListening
            ? 'جاري الاستماع… تحدّث بالعامية المصرية'
            : 'اسأل Gates Intelligence أو أرفق فاتورة أو انطق أمراً…'
        }
        disabled={sending}
        className="max-h-32 min-h-[40px] w-full resize-none overflow-y-auto bg-transparent px-2 py-1.5 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-60 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      />
      <div className="mt-1 flex items-center justify-between gap-2 px-0.5">
        <div className="flex items-center gap-0.5">
          <input
            ref={fileRef}
            type="file"
            accept={INVOICE_OCR_ACCEPT}
            className="hidden"
            onChange={(event) => {
              pickFile(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(event) => {
              pickFile(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={sending}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-[#0E79AA] disabled:opacity-50"
            title="إرفاق صورة أو PDF لفاتورة مشتريات"
            aria-label="إرفاق فاتورة"
          >
            <Paperclip className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            disabled={sending}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-[#0E79AA] disabled:opacity-50"
            title="تصوير فاتورة"
            aria-label="تصوير فاتورة"
          >
            <Camera className="h-3.5 w-3.5" />
          </button>
          <AiKnowledgeUploadButton variant="icon" showCategorySelect={false} />
        </div>
        <p className="hidden min-w-0 flex-1 truncate text-center text-[10px] text-slate-400 sm:block">
          Enter ↵ للإرسال · Shift+Enter لسطر جديد
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              if (voice.isListening) {
                voice.stopListening();
                return;
              }
              voiceBaseRef.current = draft;
              voice.startListening();
            }}
            disabled={sending}
            className={`relative inline-flex h-8 w-8 items-center justify-center rounded-full transition disabled:opacity-50 ${
              voice.isListening
                ? 'bg-red-500 text-white shadow-[0_0_12px_rgba(248,113,113,0.55)]'
                : 'text-slate-500 hover:bg-slate-100 hover:text-[#0E79AA]'
            }`}
            title={
              voice.isSupported
                ? 'أمر صوتي بالعامية — يُفرَّغ في خانة الإدخال'
                : 'تسجيل محلي. التفريغ التلقائي يحتاج Chrome أو Safari'
            }
            aria-label={voice.isListening ? 'إيقاف الاستماع' : 'أمر صوتي'}
            aria-pressed={voice.isListening}
          >
            {voice.isListening ? (
              <span className="absolute inset-0 animate-ping rounded-full bg-red-400/70" aria-hidden />
            ) : null}
            <Mic className="relative h-3.5 w-3.5" />
          </button>
          {streaming ? (
            <button
              type="button"
              onClick={onStop}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-white transition hover:bg-slate-700"
              aria-label="إيقاف"
              title="إيقاف"
            >
              <Square className="h-3 w-3 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSend}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition ${
                canSend
                  ? 'bg-[#0E79AA] text-white shadow-[0_0_12px_rgba(14,121,170,0.45)]'
                  : 'bg-slate-200 text-slate-400'
              }`}
              aria-label="إرسال"
              title="إرسال"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      {voice.error ? <p className="mt-1 px-1 text-[10px] text-amber-700">{voice.error}</p> : null}
    </form>
  );
}
