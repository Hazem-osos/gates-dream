'use client'
import React from 'react';

export default function AccountingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="erp-contain min-w-0 flex-1 p-3">
        {children}
      </div>
    </div>
  );
}
