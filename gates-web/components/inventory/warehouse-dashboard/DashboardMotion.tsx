'use client';

import type { ReactNode } from 'react';

export function DashboardMotion({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        @keyframes wh-rise {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: none; }
        }
        @keyframes wh-bar {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        @keyframes wh-dot {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.35); opacity: 0.55; }
        }
        .wh-rise { animation: wh-rise 0.55s ease both; }
        .wh-bar { transform-origin: right center; animation: wh-bar 0.8s ease both; }
        .wh-dot { animation: wh-dot 1.6s ease-in-out infinite; }
      `}</style>
      {children}
    </>
  );
}
