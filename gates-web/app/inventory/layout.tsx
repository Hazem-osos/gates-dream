export default function InventoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="erp-contain min-h-screen bg-white" dir="rtl">
      {children}
    </div>
  );
}
