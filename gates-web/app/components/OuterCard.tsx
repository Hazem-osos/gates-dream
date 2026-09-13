import React from "react";

const OuterCard = ({ children, title }: { children: React.ReactNode; title?: string }) => (
  <div className="overflow-hidden self-stretch px-8 py-6 bg-white rounded-2xl max-md:px-5  flex flex-col gap-0">
    {title ? <h2 className="text-lg font-bold text-[#0E79AA] mb-4">{title}</h2> : null}
    {children}
  </div>
);

export default OuterCard; 