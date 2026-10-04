export default function InventoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="erp-contain min-h-full bg-white" dir="rtl">
      {children}
    </div>
  );
}
