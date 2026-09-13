'use client';

import { useCallback, useState } from 'react';

const MAX_LOGO_BYTES = 512 * 1024;

type Props = {
  logoUrl: string;
  onLogoUrl: (url: string) => void;
  onError?: (message: string) => void;
  className?: string;
};

export function LogoFileUpload({ logoUrl, onLogoUrl, onError, className }: Props) {
  const [fileName, setFileName] = useState('');

  const onFile = useCallback(
    (file: File | null) => {
      if (!file) return;
      if (file.size > MAX_LOGO_BYTES) {
        onError?.('حجم الشعار يجب أن يكون أقل من 512 ك.ب');
        return;
      }
      if (!file.type.startsWith('image/')) {
        onError?.('يرجى اختيار ملف صورة');
        return;
      }
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = () => {
        const url = reader.result as string;
        if (url.length > 500_000) {
          onError?.('الصورة كبيرة جداً — استخدم صورة أصغر');
          return;
        }
        onLogoUrl(url);
      };
      reader.readAsDataURL(file);
    },
    [onError, onLogoUrl]
  );

  return (
    <div className={className}>
      <span className="text-sm text-gray-600 block mb-1">شعار الشركة</span>
      <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#D6EAF3] bg-[#F6FBFD] p-6 cursor-pointer hover:border-[#0E79AA]/50 transition">
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="sr-only"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
        <span className="text-sm text-[#0E79AA] font-medium">اسحب الصورة أو انقر للرفع</span>
        {fileName ? <span className="text-xs text-gray-500">{fileName}</span> : null}
      </label>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- local data: URL preview
        <img src={logoUrl} alt="" className="mt-3 h-16 object-contain mx-auto" />
      ) : null}
      <label className="block mt-3">
        <span className="text-xs text-gray-500">أو رابط مباشر للشعار</span>
        <input
          className="mt-1 w-full py-2 px-3 border border-[#D6EAF3] bg-white rounded-lg text-right text-sm"
          placeholder="https://…"
          value={logoUrl.startsWith('data:') ? '' : logoUrl}
          onChange={(e) => onLogoUrl(e.target.value)}
        />
      </label>
    </div>
  );
}
