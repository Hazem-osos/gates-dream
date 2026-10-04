export const ETA_SIGNING_STATES = [
  'IDLE',
  'PREPARING_DOCUMENT',
  'OPENING_SIGNER',
  'WAITING_FOR_SIGNATURE',
  'SIGNED',
  'SUBMITTING_TO_ETA',
  'ACCEPTED',
  'REJECTED',
  'SIGNER_NOT_INSTALLED',
  'TOKEN_NOT_FOUND',
  'CERTIFICATE_NOT_FOUND',
  'USER_CANCELLED',
  'SIGNING_FAILED',
  'SUBMISSION_FAILED',
] as const;

export type EtaSigningState = (typeof ETA_SIGNING_STATES)[number];

export const ETA_SIGNING_BUSY: ReadonlySet<EtaSigningState> = new Set([
  'PREPARING_DOCUMENT',
  'OPENING_SIGNER',
  'WAITING_FOR_SIGNATURE',
  'SIGNED',
  'SUBMITTING_TO_ETA',
]);

export const ETA_SIGNING_COPY: Record<EtaSigningState, string> = {
  IDLE: '',
  PREPARING_DOCUMENT: 'جاري تجهيز الفاتورة...',
  OPENING_SIGNER: 'جاري فتح برنامج التوقيع الإلكتروني...',
  WAITING_FOR_SIGNATURE: 'أكد التوقيع على جهاز Windows ثم أدخل الرقم السري في برنامج Gates المحلي فقط.',
  SIGNED: 'تم استلام التوقيع. جاري الإرسال...',
  SUBMITTING_TO_ETA: 'جاري الإرسال لمصلحة الضرائب...',
  ACCEPTED: 'تم قبول المستند من مصلحة الضرائب',
  REJECTED: 'مصلحة الضرائب رفضت المستند',
  SIGNER_NOT_INSTALLED: 'برنامج التوقيع الإلكتروني غير متاح على هذا الجهاز.',
  TOKEN_NOT_FOUND: 'لم يتم العثور على جهاز التوقيع الإلكتروني. تأكد من توصيل USB Token ثم أعد المحاولة.',
  CERTIFICATE_NOT_FOUND: 'لم يتم العثور على شهادة التوقيع على جهاز التوقيع. اختر الشهادة من برنامج التوقيع.',
  USER_CANCELLED: 'تم إلغاء التوقيع',
  SIGNING_FAILED: 'تعذر فتح برنامج التوقيع الإلكتروني.',
  SUBMISSION_FAILED: 'تعذر إرسال المستند الموقّع لمصلحة الضرائب',
};

export function canStartEtaSigning(state: EtaSigningState): boolean {
  return !ETA_SIGNING_BUSY.has(state);
}

export function nextEtaSigningState(
  state: EtaSigningState,
  event:
    | 'prepare'
    | 'prepared'
    | 'open-signer'
    | 'waiting'
    | 'signed'
    | 'submit'
    | 'accepted'
    | 'rejected'
    | 'signer-missing'
    | 'token-missing'
    | 'certificate-missing'
    | 'cancelled'
    | 'sign-failed'
    | 'submit-failed'
    | 'reset'
): EtaSigningState {
  if (event === 'reset') return 'IDLE';
  if (event === 'prepare' && canStartEtaSigning(state)) return 'PREPARING_DOCUMENT';
  if (state === 'PREPARING_DOCUMENT' && event === 'prepared') return 'OPENING_SIGNER';
  if (state === 'OPENING_SIGNER' && event === 'waiting') return 'WAITING_FOR_SIGNATURE';
  if ((state === 'OPENING_SIGNER' || state === 'WAITING_FOR_SIGNATURE') && event === 'signed') {
    return 'SIGNED';
  }
  if (state === 'SIGNED' && event === 'submit') return 'SUBMITTING_TO_ETA';
  if (state === 'SUBMITTING_TO_ETA' && event === 'accepted') return 'ACCEPTED';
  if (state === 'SUBMITTING_TO_ETA' && event === 'rejected') return 'REJECTED';
  if (event === 'signer-missing') return 'SIGNER_NOT_INSTALLED';
  if (event === 'token-missing') return 'TOKEN_NOT_FOUND';
  if (event === 'certificate-missing') return 'CERTIFICATE_NOT_FOUND';
  if (event === 'cancelled') return 'USER_CANCELLED';
  if (event === 'sign-failed') return 'SIGNING_FAILED';
  if (event === 'submit-failed') return 'SUBMISSION_FAILED';
  return state;
}
