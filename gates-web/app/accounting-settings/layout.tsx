export default function AccountingSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white" dir="rtl">
      {children}
    </div>
  );
}
