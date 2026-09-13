export default function Loading() {
  return (
    <div
      className="min-h-[50vh] flex flex-col items-center justify-center gap-8 px-6 py-16"
      dir="rtl"
      aria-busy="true"
      aria-label="جاري التحميل"
    >
      <div className="relative flex h-20 w-20 items-center justify-center">
        <div
          className="absolute inset-0 rounded-2xl border-2 border-[#D6EAF3] bg-white shadow-md"
          aria-hidden
        />
        <div
          className="absolute inset-2 animate-pulse rounded-xl bg-gradient-to-br from-[#0E78AA] to-[#0A5F8A] opacity-90"
          aria-hidden
        />
        <span className="relative text-lg font-bold text-white tracking-tight">G</span>
      </div>
      <div className="flex w-full max-w-sm flex-col gap-3">
        <div
          className="mr-auto h-2 w-3/4 animate-pulse rounded-full bg-[#E6F0F7]"
          aria-hidden
        />
        <div className="h-2 w-full animate-pulse rounded-full bg-[#E6F0F7]" aria-hidden />
        <div
          className="ml-auto h-2 w-5/6 animate-pulse rounded-full bg-[#E6F0F7]"
          aria-hidden
        />
      </div>
      <p className="text-sm font-medium text-[#094C6B]">جاري تحميل الصفحة…</p>
    </div>
  );
}
