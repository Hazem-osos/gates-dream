import React from "react";

const InnerCard = ({ children }: { children: React.ReactNode }) => (
  <div className="w-full max-md:max-w-full mb-6 border border-[color:var(--Highlight,#D6EAF3)] rounded-2xl px-8 py-6">
    {children}
  </div>
);

export default InnerCard; 