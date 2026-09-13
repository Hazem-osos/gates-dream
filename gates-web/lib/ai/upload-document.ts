import { apiClient } from '@/lib/api/client';

export const AI_DOCUMENT_CATEGORIES = [
  { id: 'CONTRACT', label: 'عقد / اتفاقية' },
  { id: 'BOQ_SPECIFICATION', label: 'مواصفات / مقايسة' },
  { id: 'HR_POLICY', label: 'سياسة موارد بشرية' },
  { id: 'COMPANY_BYLAW', label: 'لائحة الشركة' },
  { id: 'TAX_REGULATION', label: 'لائحة ضريبية' },
  { id: 'OTHER', label: 'أخرى' },
] as const;

export async function uploadAiKnowledgeDocument(input: {
  file: File;
  category: string;
  referenceId?: string;
  title?: string;
}) {
  const form = new FormData();
  form.append('file', input.file);
  form.append('category', input.category);
  if (input.referenceId) form.append('referenceId', input.referenceId);
  if (input.title) form.append('title', input.title);
  return apiClient.upload<{
    id: string;
    title: string;
    totalChunks: number;
    category: string;
    fileName: string;
  }>('/ai/documents/upload', form);
}