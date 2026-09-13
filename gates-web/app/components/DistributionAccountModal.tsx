"use client";

import React from 'react';
import { ActionButtons, FormSectionCard, compactControlClass } from '@/components/ui';

interface DistributionAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DistributionAccountModal({ isOpen, onClose }: DistributionAccountModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50" style={{ direction: 'rtl' }}>
      <div
        className="fixed inset-0 bg-black/50 transition-opacity duration-300"
        onClick={onClose}
      />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl rounded-2xl border border-[#E6F0F7] bg-white shadow-2xl">
          <div className="rounded-t-2xl border-b border-[#E6F0F7] bg-white p-5 text-center">
            <h2 className="text-lg font-bold text-[#0A3D5E]">حساب توزيعي</h2>
          </div>

          <div className="p-5">
            <FormSectionCard className="mb-0" bodyClassName="grid-cols-1 sm:grid-cols-1 lg:grid-cols-1">
              <div className="overflow-hidden rounded-xl border border-[#E6F0F7]">
                <div className="flex bg-[#0E78AA] text-sm font-semibold text-white">
                  <div className="flex-1 p-2.5 text-center">الحساب</div>
                  <div className="flex-1 border-r border-white/20 p-2.5 text-center">الحساب %</div>
                </div>

                <div className="bg-[#F6FBFD]">
                  <div className="flex border-b border-[#E6F0F7]">
                    <div className="flex-1 p-2 text-center">
                      <input
                        type="text"
                        className={compactControlClass}
                        placeholder="الحساب"
                      />
                    </div>
                    <div className="flex-1 border-r border-[#E6F0F7] p-2 text-center">
                      <input
                        type="text"
                        className={compactControlClass}
                        placeholder="الحساب %"
                      />
                    </div>
                  </div>
                  <div className="flex border-b border-[#E6F0F7]">
                    <div className="flex-1 p-2 text-center">
                      <input
                        type="text"
                        className={compactControlClass}
                        placeholder="الحساب"
                      />
                    </div>
                    <div className="flex-1 border-r border-[#E6F0F7] p-2 text-center">
                      <input
                        type="text"
                        className={compactControlClass}
                        placeholder="الحساب %"
                      />
                    </div>
                  </div>
                  <div className="flex border-b border-[#E6F0F7]">
                    <div className="flex-1 p-2 text-center">
                      <input
                        type="text"
                        className={compactControlClass}
                        placeholder="الحساب"
                      />
                    </div>
                    <div className="flex-1 border-r border-[#E6F0F7] p-2 text-center">
                      <input
                        type="text"
                        className={compactControlClass}
                        placeholder="الحساب %"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex rounded-b-lg bg-[#EAF6FB] text-sm font-semibold text-[#094C6B]">
                  <div className="flex-1 p-2.5 text-center">المجموع</div>
                  <div className="flex-1 border-r border-[#E6F0F7] p-2.5 text-center">11234</div>
                </div>
              </div>
            </FormSectionCard>
          </div>

          <div className="flex justify-end gap-2 border-t border-[#E6F0F7] p-4">
            <ActionButtons onCancel={onClose} respectPermissions={false} />
          </div>
        </div>
      </div>
    </div>
  );
}
