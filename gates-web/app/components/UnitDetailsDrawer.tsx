import React from "react";
import { CenteredOverlay } from '@/components/erp/CenteredOverlay';

interface UnitDetailsDrawerProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const UnitDetailsDrawer: React.FC<UnitDetailsDrawerProps> = ({ open, onClose, children }) => {
  return (
    <CenteredOverlay open={open} onClose={onClose} width="md">
      <div className="relative overflow-y-auto bg-gradient-to-b from-[#F6FBFD] to-[#EAF6FB] p-8">
        <button
          className="absolute left-6 top-6 text-[#0E78AA] text-3xl font-bold focus:outline-none hover:text-[#094C6B] transition-colors duration-200 w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/50 z-10"
          onClick={onClose}
          aria-label="إغلاق"
        >
          ×
        </button>
        <div className="mt-8">
          {children}
        </div>
      </div>
    </CenteredOverlay>
  );
};

export default UnitDetailsDrawer;
