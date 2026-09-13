import { apiClient } from '@/lib/api/client';
import { AUTH_TOKEN_COOKIE_NAME } from '@/lib/auth/constants';
import { buildTenantRequestHeaders } from '@/lib/tenant/tenant-context-storage';
import type {
  AttachmentLinkFilters,
  DocumentAttachment,
  DocumentCategory,
  PresignUploadResponse,
} from './types';

function resolveApiBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (typeof window !== 'undefined') return `${window.location.origin}/api/v1`;
  return 'http://127.0.0.1:3001/api/v1';
}

function readAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  const fromStorage = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
  if (fromStorage) return fromStorage;
  const prefix = `${AUTH_TOKEN_COOKIE_NAME}=`;
  const segment = document.cookie.split(';').map((c) => c.trim()).find((c) => c.startsWith(prefix));
  if (!segment) return null;
  try {
    return decodeURIComponent(segment.slice(prefix.length));
  } catch {
    return segment.slice(prefix.length) || null;
  }
}

function csrfHeader(): Record<string, string> {
  if (typeof document === 'undefined') return {};
  const match = document.cookie.split(';').map((c) => c.trim()).find((c) => c.startsWith('XSRF-TOKEN='));
  if (!match) return {};
  const value = decodeURIComponent(match.split('=')[1] || '');
  return value ? { 'X-CSRF-Token': value } : {};
}

function apiHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = readAuthToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...csrfHeader(),
    ...buildTenantRequestHeaders('PUT', true),
    ...extra,
  };
}

export async function listAttachments(filters: AttachmentLinkFilters): Promise<DocumentAttachment[]> {
  const res = await apiClient.get<DocumentAttachment[]>('/attachments', filters);
  return res.data ?? [];
}

export async function archiveAttachment(id: string): Promise<void> {
  await apiClient.patch(`/attachments/${id}/archive`, {});
}

export async function deleteAttachment(id: string): Promise<void> {
  await apiClient.delete(`/attachments/${id}`);
}

export async function getAttachmentDownloadUrl(id: string): Promise<string> {
  const res = await apiClient.get<{ download: { url: string } }>(`/attachments/${id}/download`);
  const url = res.data?.download?.url;
  if (!url) throw new Error('تعذر إصدار رابط التحميل');
  if (url.startsWith('http://') || url.startsWith('https://')) return url;

  const streamUrl = `${resolveApiBaseUrl()}/attachments/${id}/stream`;
  const response = await fetch(streamUrl, { headers: apiHeaders() });
  if (!response.ok) throw new Error('تعذر فتح المرفق');
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export async function uploadAttachmentFile(input: {
  file: File;
  fileCategory?: DocumentCategory;
  description?: string;
  links: AttachmentLinkFilters;
}): Promise<DocumentAttachment> {
  const presign = await apiClient.post<PresignUploadResponse>('/attachments/presign', {
    originalFileName: input.file.name,
    mimeType: input.file.type || 'application/octet-stream',
    fileSize: input.file.size,
    fileCategory: input.fileCategory ?? 'GENERAL',
    description: input.description,
    ...input.links,
  });
  const payload = presign.data;
  if (!payload) throw new Error('تعذر تجهيز الرفع');

  const uploadUrl = payload.upload.url.startsWith('/')
    ? `${resolveApiBaseUrl()}${payload.upload.url.replace(/^\/api\/v1/, '')}`
    : payload.upload.url;

  const isLocalTicket = Boolean(payload.upload.uploadToken);
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: isLocalTicket
      ? apiHeaders({
          ...payload.upload.headers,
          'X-Upload-Token': payload.upload.uploadToken ?? '',
        })
      : payload.upload.headers,
    body: input.file,
  });
  if (!response.ok) {
    throw new Error('فشل رفع الملف إلى التخزين');
  }

  if (!isLocalTicket) {
    const completed = await apiClient.post<DocumentAttachment>(
      `/attachments/${payload.attachment.id}/complete`,
      {}
    );
    return completed.data ?? payload.attachment;
  }

  return payload.attachment;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} بايت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ك.ب`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} م.ب`;
}
