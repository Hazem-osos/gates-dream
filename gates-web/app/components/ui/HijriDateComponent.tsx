'use client';

import React from 'react';

interface HijriDateComponentProps {
  className?: string;
}

export const HijriDateComponent: React.FC<HijriDateComponentProps> = ({ className = "" }) => {
  return (
    <span className={`text-[#0A3D5E] font-semibold text-sm flex items-center ${className}`}>
      الهجري
    </span>
  );
};

export default HijriDateComponent;
