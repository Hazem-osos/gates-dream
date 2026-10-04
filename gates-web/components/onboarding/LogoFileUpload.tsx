'use client';

import { useCallback, useState } from 'react';

const MAX_LOGO_BYTES = 512 * 1024;

function compressLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read'));
    reader.onload = () => {
      const original = reader.result;
      if (typeof original !== 'string') {
        reject(new Error('read'));
        return;
      }
      const image = new Image();
      image.onerror = () => resolve(original);
      image.onload = () => {
        const maxSide = 480;
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(original);
          return;
        }
        ctx.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      image.src = original;
    };
    reader.readAsDataURL(file);
  });
}

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
      void compressLogo(file)
        .then((url) => {
          if (url.length > 500_000) {
            onError?.('الصورة كبيرة جداً — استخدم صورة أصغر');
            return;
          }
          onLogoUrl(url);
        })
        .catch(() => onError?.('تعذر قراءة الشعار'));
    },
    [onError, onLogoUrl]
  );

  return (
    <div className={className}>
      <span className="text-sm text-gray-600 block mb-1">شعار الشركة</span>
      <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#D6EAF3] bg-[#F6FBFD] p-6 cursor-pointer hover:border-[#0E78AA]/50 transition">
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="sr-only"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
        <span className="text-sm text-[#0E78AA] font-medium">اسحب الصورة أو انقر للرفع</span>
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
